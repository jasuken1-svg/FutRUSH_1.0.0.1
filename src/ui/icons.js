// Uygulama butonlari ve panellerinde kullanilan SVG ikon sabitlerini sunar.
// Bagimlilik: yok.

export const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 2 64 84" preserveAspectRatio="xMidYMid meet"> <defs> <linearGradient id="fr-ring" x1="0" y1="0" x2="1" y2="1"> <stop offset="0" stop-color="#00E5FF"/> <stop offset=".55" stop-color="#7C4DFF"/> <stop offset="1" stop-color="#FF2D95"/> </linearGradient> <linearGradient id="fr-bg" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#14264A"/> <stop offset="1" stop-color="#0A1226"/> </linearGradient> <linearGradient id="fr-bolt" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#FFF176"/> <stop offset=".5" stop-color="#FFB300"/> <stop offset="1" stop-color="#FF4D2E"/> </linearGradient> </defs> <path d="M40 4 L70 14 V46 C70 64 56 76 40 83 C24 76 10 64 10 46 V14 Z" fill="url(#fr-bg)" stroke="url(#fr-ring)" stroke-width="3" stroke-linejoin="round"/> <path d="M15 30h11M13 41h13M17 52h9" stroke="#00E5FF" stroke-width="3" stroke-linecap="round" opacity=".9"/> <polygon points="48,12 29,45 40,45 35,72 56,36 44,36 53,12" fill="url(#fr-bolt)" stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round"/> </svg>';

export const LOGO_SVG = ICON_SVG.replace(/fr-(ring|bg|bolt)/g, 'fr-lg-$1');

export const SB_BOLT_SVG =
    '<svg class="fr-sb-bolt" xmlns="http://www.w3.org/2000/svg" viewBox="26 10 32 64" aria-hidden="true">' +
    '<defs><linearGradient id="fr-sb-bolt-g" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#FFF176"/><stop offset=".5" stop-color="#FFB300"/><stop offset="1" stop-color="#FF4D2E"/>' +
    '</linearGradient></defs>' +
    '<polygon points="48,12 29,45 40,45 35,72 56,36 44,36 53,12" fill="url(#fr-sb-bolt-g)" ' +
    'stroke="#FFFFFF" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round"/></svg>';

export const FUTBIN_ICON_DATA =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADFklEQVRYha2XO2gVQRSGvxuTmIeKoIVgo4IEBR/FGJOIMYY0RkVFplDjVEpEKxtBtBCsNHYWYiHCSKrxBRoSo4SUSkYQKx9IBGMQX1ETVGL0Wuxu3OyduXtzrz8s7J75d85/9585c24GD6TVtcBnoNLH8eAbUG+Eel4IuSzPWGsRyQEWAHek1QtLFbCtiOQRVgLd0uo5pQioL0EAQDtwNo2UcQWl1TUE/s91DE8A2VkIOWCEuuMbLPfEt3qSvwOWGqH+zEJAXvgs8Pnf+z+Tg/8L+PyfklbvLzJXFrhhhJrMK0BaXQ2s8UxyOLyKxWXgSDzgsqAFqCoywU8gn0Wd0urONAHtRSYHuAXsDYX4cFFa3ZxPQCn7v98IdZtgF33ycCqAm9LqZZBYA9LqKmCt58WTwFiKgD4AI9RDaXUjcA9Y7uAtAjqBk8lFuAW3/x+ALiPU7xQB0zBCvZRWNwB3gQ0OyiPItcDnf99sksdQ58gR4THkbsONHvL96EZafQ1Y7eCcNkL1hpx1wHmgzSNgOEtmZIYAafVc/P7bkFMB7AFqHZw30uoVwDlgN/4iB9BzXRzMkiA1A9UO8ifgRXi/yZN8EjgBSNJriCH4OiQFFOL/dg+nEjiYkjgLtBmhBuLBuD8+//tj9w0pSfIhAxxPNillANLqSmCd58W4/+tnkfAZ8DER2wGcyREAbAZqHJN85p//TcC8AhKPAB0EFdXFPyWtXpIU4PP2nhFqKoUTF3sUqDNCdRMsWNeCHAXeRw/RIlzsmbQQ/78T9H6XjFBfY/GCmppIwDFAAKsS5Mj/cvz+txihhhxx36J+EH8oAzBCjQM7CT5jhC8ECwmCXz/fMdk48CQZLKSoRZiuA0aoV9LqfUBPGC/E/0GylMshnax6rbiL2mtgOB6YUaeNUP0Exy4ER2mEJo+AHWSYyLnA14Z3JZvanIPCCHUB6AaGAMLC4fM/E86RvFz/N54CV5NB34FxCPgV3jcQ/N8rBaPALiPUj4IEGKHiPV3a/k/DINBhhHrrGsx3ZEZoLCLpGDAAXCHoE73NzF89J9UVxMx9nQAAAABJRU5ErkJggg==';
