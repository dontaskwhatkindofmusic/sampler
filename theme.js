'use strict';
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
let themeChoice='system';try{const value=localStorage.getItem('letter-sampler-theme');if(['system','light','dark'].includes(value))themeChoice=value}catch{}
function applyTheme(){const dark=themeChoice==='dark'||(themeChoice==='system'&&systemTheme.matches);document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';document.getElementById('browserTheme').content=dark?'#171717':'#ffffff';const statusBar=document.getElementById('statusBarTheme');if(statusBar)statusBar.content=dark?'black-translucent':'default'}
function setTheme(choice){themeChoice=['system','light','dark'].includes(choice)?choice:'system';try{localStorage.setItem('letter-sampler-theme',themeChoice)}catch{}applyTheme()}
systemTheme.addEventListener('change',applyTheme);applyTheme();
