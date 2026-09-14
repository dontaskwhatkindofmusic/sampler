// Pick the interface before initializing audio and controls. Both live at index.html.
const layoutQuery=matchMedia('(max-width: 700px), (pointer: coarse) and (max-width: 1000px)');
const layoutOptions=new URLSearchParams(location.search);
const useTouchLayout=!layoutOptions.has('desktop')&&(layoutOptions.has('touch')||layoutQuery.matches);
document.documentElement.dataset.mobile=String(useTouchLayout);
document.getElementById('desktopStyle').disabled=useTouchLayout;
document.getElementById('touchStyle').disabled=!useTouchLayout;
const layoutTemplate=document.getElementById(useTouchLayout?'touchLayout':'desktopLayout');
document.body.insertBefore(layoutTemplate.content.cloneNode(true),document.getElementById('desktopLayout'));
