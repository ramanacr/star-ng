import { bootstrapApplication } from '@angular/platform-browser';
import { provideStarUiText } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import { App } from './app/app';

bootstrapApplication(App, { providers: [provideStarUiText(STAR_UI_TEXT_DE)] }).catch(
  (error: unknown) => console.error(error),
);
