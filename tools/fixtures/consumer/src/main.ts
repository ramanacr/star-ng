import { bootstrapApplication } from '@angular/platform-browser';
import { provideStarUiText } from 'star-ng/core';
import { STAR_UI_TEXT_DE } from 'star-ng/i18n/de';
import { App } from './app/app';

bootstrapApplication(App, { providers: [provideStarUiText(STAR_UI_TEXT_DE)] }).catch(
  (error: unknown) => console.error(error),
);
