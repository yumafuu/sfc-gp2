import YAML from 'yaml';
import { mdToPdf } from 'md-to-pdf';
import config from "../config.js";
import { BuildMokuji } from './src/mokuji.ts';

const pagerbreak = `<div class="page-break"></div>\n\n`;

export interface Document {
  sections: Section[];
}

export interface Section {
  title: string;
  index: string;
  content: string;
  page: number;
  subsections?: Section[];
}

const dir = import.meta.url.replace("/build.ts", "").replace("file://", "");
const file = Bun.file(`${dir}/content.yaml`);
const yamlcontent = await file.text();

const parsed: Document = YAML.parse(yamlcontent);

let mokujis: [number, string, string][] = []
const processSections = (sections: Section[], page: number) => {
  sections.forEach((section) => {
    page = section.page || page;
    mokujis.push([page, section.index, section.title]);

    if (section.subsections) {
      processSections(section.subsections, page);
    }
  });
}
processSections(parsed.sections, 0);

let mdcontent = "";
const hyoshi = await ( Bun.file(`contents/hyoshi.md`) ).text()

mdcontent += hyoshi
mdcontent += pagerbreak
mdcontent += BuildMokuji(mokujis);
mdcontent += pagerbreak
mdcontent += "aaaaaa"

const pdf = await mdToPdf({ content: mdcontent }, config)

await Bun.write("main.pdf", pdf.content);
console.log("PDF generated successfully")
