import { starEditorCleanPaste } from './editor-paste';
import { starEditorSanitize } from './editor-sanitize';

/** The full paste path: cleanup, then the sanitizer. */
const paste = (html: string) => starEditorSanitize(starEditorCleanPaste(html, document), document);

/** A copy from Microsoft Word: XML islands, Office styles, list paragraphs. */
const WORD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>p.MsoNormal { font-size: 11pt; font-family: "Calibri", sans-serif; }</style></head>
<body lang="EN-US">
<h1 style="mso-margin-top-alt:auto"><span style="font-size:20pt;font-family:Calibri">Release 4.2</span></h1>
<p class="MsoNormal" style="mso-pagination:none"><span style="font-size:12.0pt;color:windowtext">The <b>new dashboard</b> ships <span style="color:#C00000">today</span>.<o:p></o:p></span></p>
<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span style="font:7.0pt 'Times New Roman'">&nbsp;&nbsp;&nbsp; </span></span>Faster reports</p>
<p class="MsoListParagraphCxSpMiddle" style="mso-list:l0 level2 lfo1"><span style="mso-list:Ignore">o<span>&nbsp; </span></span>Export to PDF</p>
<p class="MsoListParagraphCxSpLast" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp; </span></span>Saved filters</p>
<p class="MsoListParagraphCxSpFirst" style="mso-list:l1 level1 lfo2"><span style="mso-list:Ignore">1.<span>&nbsp; </span></span>Install</p>
<p class="MsoListParagraphCxSpLast" style="mso-list:l1 level1 lfo2"><span style="mso-list:Ignore">2.<span>&nbsp; </span></span>Sign in</p>
<table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;mso-yfti-tbllook:1184"><tr><td width="200" valign="top" style="width:150pt;border:solid windowtext 1.0pt"><p class="MsoNormal">Plan</p></td></tr></table>
</body></html>`;

/** A copy from Google Docs: a b wrapper, styles for bold and italic. */
const GOOGLE_DOCS =
  '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b"><p dir="ltr" style="line-height:1.38;margin-top:0pt"><span style="font-size:11pt;font-family:Arial;color:#000000;background-color:transparent;font-weight:700;font-style:normal;">Bold</span><span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:400;font-style:italic;">italic</span><span style="font-size:11pt;vertical-align:super;">2</span><span style="text-decoration:line-through;">old</span></p><ul style="margin-top:0"><li dir="ltr" style="list-style-type:disc"><p dir="ltr"><span style="font-size:11pt">Item</span></p></li></ul></b><br class="Apple-interchange-newline">';

/** A copy from a web page: classes, layout styles, a script and a tracking attribute. */
const WEB =
  '<div class="article__body" data-track="x" style="font-family: Inter; line-height: 1.6; padding: 24px"><h2 class="title" id="news">News</h2><p style="color: rgb(33, 33, 33); font-size: 18px">Read the <a href="https://example.com/news" class="link" onclick="track()">news</a>.</p><script>track()</script><p style="text-align: center; background-color: rgb(255, 255, 255)">Center</p></div>';

describe('starEditorCleanPaste', () => {
  it('cleans a Word copy and turns list paragraphs into nested lists', () => {
    expect(paste(WORD)).toBe(
      '<h1>Release 4.2</h1>\n' +
        '<p>The <b>new dashboard</b> ships <span style="color: #c00000">today</span>.</p>\n' +
        '<ul><li>Faster reports<ul><li>Export to PDF</li></ul></li><li>Saved filters</li></ul>\n' +
        '<ol><li>Install</li><li>Sign in</li></ol>\n' +
        '<table><tbody><tr><td style="width: 150pt"><p>Plan</p></td></tr></tbody></table>',
    );
  });

  it('cleans a Google Docs copy: formats from styles, no wrapper', () => {
    expect(paste(GOOGLE_DOCS)).toBe(
      '<p dir="ltr"><b>Bold</b><i>italic</i><sup>2</sup><s>old</s></p><ul><li dir="ltr"><p dir="ltr">Item</p></li></ul>',
    );
  });

  it('cleans a web page copy: structure stays, the look and scripts go', () => {
    expect(paste(WEB)).toBe(
      '<div><h2>News</h2><p style="color: rgb(33, 33, 33)">Read the <a href="https://example.com/news">news</a>.</p><p style="text-align: center">Center</p></div>',
    );
  });

  it('keeps the classes of the editor', () => {
    expect(paste('<ul class="star-checklist other"><li data-checked="true">Done</li></ul>')).toBe(
      '<ul class="star-checklist"><li data-checked="true">Done</li></ul>',
    );
    expect(starEditorCleanPaste('', document)).toBe('');
  });
});
