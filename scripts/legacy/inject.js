(function(){
  const btns = [...document.querySelectorAll('button')];
  console.log('Buttons:', btns.map(b => b.id || b.textContent.trim()).join(', '));
})();
