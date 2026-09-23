"""Backup regression tests use disposable SQLite databases only."""
from contextlib import closing
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from backend.database_backup import BACKUP_INTERVALS, DatabaseBackupService, _backup_lock


ROOT = Path(__file__).resolve().parents[2]
DAY = BACKUP_INTERVALS["short"]


def rows(path):
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
        return db.execute("SELECT value FROM sample ORDER BY rowid").fetchall()


class DatabaseBackupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tap-backup-test-")
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "current.db"
        self.db = sqlite3.connect(str(self.path))
        self.addCleanup(self.db.close)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA wal_autocheckpoint=0")
        self.db.execute("CREATE TABLE sample(value TEXT)")
        self.append("initial")
        self.now = 1800000000.0
        self.service = self.new_service()

    def new_service(self, path=None, **kwargs):
        service = DatabaseBackupService(path or self.path, clock=lambda: self.now, **kwargs)
        self.addCleanup(service.stop)
        return service

    def append(self, value):
        self.db.execute("INSERT INTO sample VALUES(?)", (value,))
        self.db.commit()

    def test_initial_snapshots_include_committed_wal_and_are_standalone(self):
        self.assertGreater(Path(str(self.path) + "-wal").stat().st_size, 0)
        self.db.execute("INSERT INTO sample VALUES('uncommitted')")
        self.assertEqual(self.service.run_due_backups(), ["short", "long"])
        for path in self.service.backup_paths.values():
            self.assertEqual(rows(path), [("initial",)])
            with closing(sqlite3.connect(str(path))) as backup:
                self.assertEqual(backup.execute("PRAGMA integrity_check").fetchall(), [("ok",)])
                self.assertEqual(backup.execute("PRAGMA journal_mode").fetchone()[0], "delete")
            self.assertEqual(path.stat().st_mtime, self.now)
            if os.name != "nt":
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual({p.name for p in self.service.backup_dir.iterdir()},
                         {"short.db", "long.db", ".backup.lock"})
        self.db.rollback()
        self.append("still writable")
        self.assertEqual(rows(self.path), [("initial",), ("still writable",)])

    def test_daily_and_weekly_rotation_keep_exactly_two_latest_snapshots(self):
        self.service.run_due_backups()
        for day in range(1, 9):
            self.append("day " + str(day))
            self.now += DAY - 1
            self.assertEqual(self.service.run_due_backups(), [])
            self.now += 1
            self.assertEqual(self.service.run_due_backups(), ["short", "long"] if day == 7 else ["short"])
            self.assertEqual(rows(self.service.backup_paths["short"]), rows(self.path))
            self.assertEqual(len(rows(self.service.backup_paths["long"])), 8 if day >= 7 else 1)
        self.assertEqual(len(list(self.service.backup_dir.glob("*.db"))), 2)

    def test_restart_preserves_schedule_and_overdue_start_takes_one_fresh_snapshot(self):
        self.service.run_due_backups()
        initial_time = self.now
        self.now += DAY - 1
        restarted = self.new_service()
        self.assertEqual(restarted.run_due_backups(), [])
        self.now += 1
        self.append("next day")
        self.assertEqual(restarted.run_due_backups(), ["short"])
        self.assertEqual(restarted.backup_paths["long"].stat().st_mtime, initial_time)
        self.now += 30 * DAY
        self.append("after downtime")
        restarted_again = self.new_service()
        self.assertEqual(restarted_again.run_due_backups(), ["short", "long"])
        self.assertEqual(restarted_again.run_due_backups(), [])
        for path in restarted_again.backup_paths.values():
            self.assertEqual(rows(path), rows(self.path))
            self.assertEqual(path.stat().st_mtime, self.now)

    def test_missing_slot_is_recreated_without_refreshing_other_slot(self):
        self.service.run_due_backups()
        long_before = self.service.backup_paths["long"].read_bytes()
        self.service.backup_paths["short"].unlink()
        self.append("new")
        self.now += 60
        self.assertEqual(self.service.run_due_backups(), ["short"])
        self.assertEqual(self.service.backup_paths["long"].read_bytes(), long_before)

    def test_databases_with_same_stem_have_separate_backups(self):
        other_path = self.path.with_suffix(".sqlite")
        with closing(sqlite3.connect(str(other_path))) as other:
            other.execute("CREATE TABLE sample(value TEXT)")
            other.execute("INSERT INTO sample VALUES('other database')")
            other.commit()
        other_service = self.new_service(other_path)
        self.service.run_due_backups()
        other_service.run_due_backups()
        self.assertNotEqual(other_service.backup_dir, self.service.backup_dir)
        self.assertEqual(rows(self.service.backup_paths["short"]), [("initial",)])
        self.assertEqual(rows(other_service.backup_paths["short"]), [("other database",)])

    def test_replace_failure_preserves_previous_snapshot_and_retries(self):
        self.service.run_due_backups()
        path = self.service.backup_paths["short"]
        previous = path.read_bytes(), path.stat().st_mtime
        self.now += DAY
        self.append("new")
        with patch("backend.database_backup.os.replace", side_effect=OSError("disk failure")), \
                self.assertLogs("tap.database_backup", level="ERROR"):
            self.assertEqual(self.service.run_due_backups(), [])
        self.assertEqual((path.read_bytes(), path.stat().st_mtime), previous)
        self.assertFalse(list(self.service.backup_dir.glob("*.tmp*")))
        self.assertEqual(self.service.run_due_backups(), ["short"])
        self.assertEqual(rows(path), rows(self.path))

    def test_failed_short_backup_does_not_block_due_long_backup(self):
        self.service.run_due_backups()
        self.now += 7 * DAY
        self.append("week later")
        create_snapshot = self.service._create_snapshot

        def fail_short(destination):
            if destination == self.service.backup_paths["short"]:
                raise OSError("short file is locked")
            create_snapshot(destination)

        with patch.object(self.service, "_create_snapshot", side_effect=fail_short), \
                self.assertLogs("tap.database_backup", level="ERROR"):
            self.assertEqual(self.service.run_due_backups(), ["long"])
        self.assertEqual(rows(self.service.backup_paths["short"]), [("initial",)])
        self.assertEqual(rows(self.service.backup_paths["long"]), rows(self.path))

    def test_missing_source_does_not_create_an_empty_database(self):
        missing = self.new_service(Path(self.temp.name) / "missing.db")
        with self.assertLogs("tap.database_backup", level="ERROR"):
            self.assertEqual(missing.run_due_backups(), [])
        self.assertFalse(missing.database_path.exists())
        self.assertFalse(list(missing.backup_dir.glob("*.db")))
        self.assertFalse(list(missing.backup_dir.glob("*.tmp*")))

    def test_corrupt_source_never_replaces_good_snapshots(self):
        self.service.run_due_backups()
        before = {kind: path.read_bytes() for kind, path in self.service.backup_paths.items()}
        self.db.close()
        self.path.write_bytes(b"broken database")
        self.now += 7 * DAY
        with self.assertLogs("tap.database_backup", level="ERROR"):
            self.assertEqual(self.service.run_due_backups(), [])
        self.assertEqual({kind: path.read_bytes() for kind, path in self.service.backup_paths.items()}, before)

    def test_timeout_retains_old_snapshot_and_cleans_temporary_files(self):
        self.service.run_due_backups()
        self.now += DAY
        service = self.new_service(backup_timeout=0)
        before = service.backup_paths["short"].read_bytes()
        with self.assertLogs("tap.database_backup", level="ERROR"):
            self.assertEqual(service.run_due_backups(), [])
        self.assertEqual(service.backup_paths["short"].read_bytes(), before)
        self.assertFalse(list(service.backup_dir.glob("*.tmp*")))

    def test_interrupted_temporary_snapshot_is_cleaned_on_next_attempt(self):
        self.service.backup_dir.mkdir(parents=True)
        for suffix in ("", "-wal", "-shm", "-journal"):
            (self.service.backup_dir / (".short.db.tmp" + suffix)).write_bytes(b"partial snapshot")
        self.assertEqual(self.service.run_due_backups(), ["short", "long"])
        self.assertFalse(list(self.service.backup_dir.glob("*.tmp*")))

    def test_other_process_skips_locked_backup_and_rechecks_published_timestamp(self):
        self.service.backup_dir.mkdir(parents=True)
        script = """import sys
from pathlib import Path
from backend.database_backup import DatabaseBackupService
service = DatabaseBackupService(Path(sys.argv[1]), clock=lambda: float(sys.argv[2]))
print(service.run_due_backups())
"""
        command = [sys.executable, "-c", script, str(self.path), str(self.now)]
        with _backup_lock(self.service.backup_dir / ".backup.lock") as acquired:
            self.assertTrue(acquired)
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=10, check=True)
            self.assertEqual(result.stdout.strip(), "[]")
        self.service.run_due_backups()
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, timeout=10, check=True)
        self.assertEqual(result.stdout.strip(), "[]")
        self.now += DAY
        self.assertEqual(self.service.run_due_backups(), ["short"])

    def test_background_worker_retries_and_stop_wakes_wait(self):
        service = self.new_service(poll_interval=0.01)
        completed = threading.Event()
        attempts = []

        def check():
            attempts.append(True)
            if len(attempts) == 1:
                raise PermissionError("temporary directory error")
            service._poll_interval = 60
            completed.set()

        with patch.object(service, "run_due_backups", side_effect=check), \
                self.assertLogs("tap.database_backup", level="ERROR"):
            service.start()
            worker = service._thread
            service.start()
            self.assertIs(service._thread, worker)
            self.assertTrue(completed.wait(timeout=2))
            before = time.monotonic()
            service.stop()
            self.assertLess(time.monotonic() - before, 1)
            self.assertFalse(worker.is_alive())
        self.assertEqual(service.run_due_backups(), [])


class DatabaseBackupLifecycleTests(unittest.TestCase):
    def test_restored_snapshot_can_start_backend_and_resume_writes(self):
        script = """import os
from pathlib import Path
import sqlite3
import time
from backend.config import settings
settings.db_file = os.environ['TAP_BACKUP_TEST_DB']
settings.default_admin_username = 'restore_test_admin'
settings.default_admin_password = 'restore-test-password'
from backend.main import database_backup_service, on_shutdown, on_startup
on_startup()
try:
    with sqlite3.connect(settings.db_file) as db:
        assert db.execute('SELECT value FROM sample').fetchall() == [('before backup',)]
        assert db.execute('SELECT username FROM users').fetchall() == [('restore_test_admin',)]
        db.execute("INSERT INTO sample VALUES('after restore')")
    deadline = time.monotonic() + 10
    while not all(path.exists() for path in database_backup_service.backup_paths.values()):
        assert time.monotonic() < deadline
        time.sleep(0.01)
finally:
    on_shutdown()
"""
        with tempfile.TemporaryDirectory(prefix="tap-backup-restore-") as directory:
            current = Path(directory) / "current.db"
            # 先由真实后端建立业务表，快照中的 sample 表用于区分备份前后写入。
            initialize = """import os
from backend.config import settings
settings.db_file = os.environ['TAP_BACKUP_TEST_DB']
settings.default_admin_username = 'restore_test_admin'
settings.default_admin_password = 'restore-test-password'
from backend.main import _run_startup_tasks
_run_startup_tasks()
"""
            result = subprocess.run(
                [sys.executable, "-c", initialize], cwd=ROOT, capture_output=True, text=True, timeout=30,
                env={**os.environ, "TAP_BACKUP_TEST_DB": str(current)},
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            with closing(sqlite3.connect(str(current))) as db:
                db.execute("CREATE TABLE sample(value TEXT)")
                db.execute("INSERT INTO sample VALUES('before backup')")
                db.commit()
                service = DatabaseBackupService(current)
                self.assertEqual(service.run_due_backups(), ["short", "long"])
                db.execute("INSERT INTO sample VALUES('after backup')")
                db.commit()
            restored = Path(directory) / "restored.db"
            shutil.copyfile(service.backup_paths["short"], restored)
            result = subprocess.run(
                [sys.executable, "-c", script], cwd=ROOT, capture_output=True, text=True, timeout=30,
                env={**os.environ, "TAP_BACKUP_TEST_DB": str(restored)},
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(rows(restored), [("before backup",), ("after restore",)])
            self.assertEqual(rows(current), [("before backup",), ("after backup",)])
            self.assertEqual(rows(service.backup_paths["short"]), [("before backup",)])

    def test_backend_lifecycle_uses_effective_database_and_static_routes_hide_backups(self):
        # 在子进程导入应用前固定临时库，防止本地配置覆盖到正式数据库。
        script = """import asyncio
import os
from pathlib import Path
import sqlite3
import time
from starlette.exceptions import HTTPException
from backend.config import settings
settings.db_file = os.environ['TAP_BACKUP_TEST_DB']
settings.default_admin_username = 'backup_test_admin'
settings.default_admin_password = 'backup-test-password'
from backend.main import database_backup_service, on_shutdown, on_startup, app
assert database_backup_service.database_path == Path(settings.db_file).resolve()
on_startup()
try:
    deadline = time.monotonic() + 10
    while not all(path.exists() for path in database_backup_service.backup_paths.values()):
        assert time.monotonic() < deadline, 'startup did not create both snapshots'
        time.sleep(0.01)
    for path in database_backup_service.backup_paths.values():
        with sqlite3.connect(str(path)) as db:
            assert db.execute('SELECT username FROM users').fetchall() == [('backup_test_admin',)]
    static = app.routes[-1].app
    async def check_static():
        for name in ('short.db', 'long.db', '.backup.lock', '.short.db.tmp'):
            try:
                await static.get_response('data/backups/current.db/' + name, {'type': 'http', 'method': 'GET'})
            except HTTPException as exc:
                assert exc.status_code == 404
            else:
                raise AssertionError('backup is publicly accessible')
    asyncio.run(check_static())
finally:
    on_shutdown()
assert database_backup_service._thread is None
"""
        with tempfile.TemporaryDirectory(prefix="tap-backup-lifecycle-") as directory:
            result = subprocess.run(
                [sys.executable, "-c", script], cwd=ROOT, capture_output=True, text=True, timeout=30,
                env={**os.environ, "TAP_BACKUP_TEST_DB": str(Path(directory) / "current.db")},
            )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
