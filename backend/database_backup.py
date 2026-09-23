"""Rolling SQLite snapshots owned by the backend lifecycle, independent of web clients."""
from contextlib import closing, contextmanager
import errno
import logging
import os
from pathlib import Path
import sqlite3
import threading
import time
from typing import Callable, Dict, List


logger = logging.getLogger("tap.database_backup")
BACKUP_INTERVALS = {"short": 24 * 60 * 60, "long": 7 * 24 * 60 * 60}


@contextmanager
def _backup_lock(path: Path):
    """跨进程互斥；进程退出时由系统释放，兼容 Windows 与 macOS/Linux。"""
    with os.fdopen(os.open(str(path), os.O_RDWR | os.O_CREAT, 0o600), "r+b", buffering=0) as handle:
        if os.fstat(handle.fileno()).st_size == 0:
            handle.write(b"\0")
        handle.seek(0)
        try:
            if os.name == "nt":
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as exc:
            if exc.errno not in (errno.EACCES, errno.EAGAIN, errno.EDEADLK):
                raise
            yield False
            return
        try:
            yield True
        finally:
            if os.name == "nt":
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


class DatabaseBackupService:
    def __init__(
        self,
        database_path: Path,
        *,
        poll_interval: float = 60,
        backup_timeout: float = 300,
        clock: Callable[[], float] = time.time,
    ) -> None:
        self.database_path = Path(database_path).resolve()
        # 按完整文件名隔离，app.db 与测试库不会覆盖彼此的备份。
        self.backup_dir = self.database_path.parent / "backups" / self.database_path.name
        self.backup_paths: Dict[str, Path] = {
            kind: self.backup_dir / (kind + ".db") for kind in BACKUP_INTERVALS
        }
        self._poll_interval = poll_interval
        self._backup_timeout = backup_timeout
        self._clock = clock
        self._stop_event = threading.Event()
        self._lifecycle_lock = threading.Lock()
        self._thread = None

    def start(self) -> None:
        with self._lifecycle_lock:
            if self._thread is not None and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run, name="database-backup", daemon=True)
            self._thread.start()
        logger.info("Database backups started: current=%s short=%s long=%s",
                    self.database_path, self.backup_paths["short"], self.backup_paths["long"])

    def stop(self) -> None:
        with self._lifecycle_lock:
            self._stop_event.set()
            if self._thread is not None:
                self._thread.join(timeout=10)
                if self._thread.is_alive():
                    logger.warning("Database backup is still stopping")
                else:
                    self._thread = None

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.run_due_backups()
            except Exception:
                logger.exception("Database backup check failed; retrying on the next check")
            self._stop_event.wait(self._poll_interval)

    def run_due_backups(self) -> List[str]:
        """只以已发布快照的完成时间计时，重启不重置周期，失败不推进周期。"""
        completed = []
        if self._stop_event.is_set():
            return completed
        self.backup_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        with _backup_lock(self.backup_dir / ".backup.lock") as acquired:
            if not acquired:
                return completed
            for kind, interval in BACKUP_INTERVALS.items():
                if self._stop_event.is_set():
                    break
                destination = self.backup_paths[kind]
                try:
                    try:
                        last_success = destination.stat().st_mtime
                    except FileNotFoundError:
                        last_success = None
                    if last_success is not None and self._clock() - last_success < interval:
                        continue
                    self._create_snapshot(destination)
                    completed.append(kind)
                    logger.info("Database %s backup completed: %s", kind, destination)
                except Exception:
                    if not self._stop_event.is_set():
                        logger.exception("Database %s backup failed; previous snapshot retained", kind)
        return completed

    def _create_snapshot(self, destination: Path) -> None:
        # 固定临时名受进程锁保护；崩溃后重试时只清理本服务自己的未完成文件。
        temporary = destination.with_name("." + destination.name + ".tmp")
        self._remove_temporary(temporary)
        deadline = time.monotonic() + self._backup_timeout

        def interrupted():
            return self._stop_event.is_set() or time.monotonic() >= deadline

        def progress(status, remaining, total):
            if interrupted():
                raise TimeoutError("Database backup cancelled or timed out")

        try:
            with os.fdopen(os.open(str(temporary), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb"):
                pass
            # mode=ro 防止源库缺失时悄悄创建空库；backup API 会包含已提交的 WAL 数据。
            with closing(sqlite3.connect(self.database_path.as_uri() + "?mode=ro", uri=True, timeout=5)) as source:
                with closing(sqlite3.connect(str(temporary), timeout=5)) as target:
                    target.set_progress_handler(lambda: int(interrupted()), 1000)
                    source.backup(target, pages=256, progress=progress, sleep=0.1)
                    # 将快照收束为一个独立文件，不依赖 WAL/SHM 文件即可恢复。
                    target.execute("PRAGMA journal_mode=DELETE")
                    if target.execute("PRAGMA quick_check").fetchall() != [("ok",)]:
                        raise sqlite3.DatabaseError("Database backup integrity check failed")
            progress(0, 0, 0)
            completed_at = self._clock()
            os.utime(temporary, (completed_at, completed_at))
            with temporary.open("r+b") as handle:
                os.fsync(handle.fileno())
            # 在同一目录原子替换；发布之前的任何失败都保留上一次成功快照。
            os.replace(str(temporary), str(destination))
        finally:
            self._remove_temporary(temporary)

    @staticmethod
    def _remove_temporary(temporary: Path) -> None:
        for suffix in ("", "-wal", "-shm", "-journal"):
            try:
                Path(str(temporary) + suffix).unlink()
            except FileNotFoundError:
                pass
