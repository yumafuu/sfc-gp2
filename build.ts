import YAML from 'yaml';
import { mdToPdf } from 'md-to-pdf';
import { PDFDocument } from 'pdf-lib';

import config from "./config.js";

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

const metapageNum = 3

const pagenumSpan = (i) => { return `<span class="align-right font-mid"> ${i} </span>` }

export const BuildMokuji = (titles) => {
  let content = "# 目次\n\n"
  content += "<section class='mokuji'>\n\n"
  for (let title of titles) {
    let [page, ver, str] = title

    // の数を数えて、その数だけ`#`をつける
    const size = ver.split(".").length
    const hprefix = `#`.repeat(size + 1)
    if (size === 1) {
      ver = `第${ver}章`
    }

    content += `${hprefix} ${ver}${str}${pagenumSpan(page)}\n\n`
  }
  content += "</section>"

  return content
}

const build = async () => {
  const dir = import.meta.url.replace("/build.ts", "").replace("file://", "");
  const file = Bun.file(`${dir}/contents/content.yaml`);
  const yamlcontent = await file.text();

  const parsed: Document = YAML.parse(yamlcontent);

  let body = "";
  let mokujis: [number, string, string][] = []
  const processSections = (sections: Section[], page: number) => {
    sections.forEach((section) => {
      page = section.page || page;
      mokujis.push([page, section.index, section.title]);

      const indexsize = section.index.split(".").length
      const mdprefix = `#`.repeat(indexsize)
      const indexstr = mdprefix === "#" ? `第${section.index}章` : section.index

      if (indexsize === 1) {
        body += pagerbreak
      }
      body += `${mdprefix} ${indexstr} ${section.title}\n\n`
      body += section.content + "\n"

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
  mdcontent += body

  const contentpdf = await mdToPdf({ content: mdcontent }, config)

  // Add page numbers
  const pdfDoc = await PDFDocument.load(contentpdf.content);
  const totalPages = pdfDoc.getPageCount();
  const romans = ['i', 'ii', 'iii', 'iv', 'v'];

  for (let i = 0; i < totalPages; i++) {
    if (i === 0) { continue }

    const pagePdf = pdfDoc.getPage(i);
    const { width } = pagePdf.getSize();
    const displayValue = i < metapageNum ? romans[i-1] : i - metapageNum + 1

    pagePdf.drawText(displayValue.toString(), {
        x: width / 2 - 10, // 中央寄せ
        y: 20, // 下からの位置
        size: 6,
      }
    );
  }
  const pdf = await pdfDoc.save();
  Bun.write("main.pdf", pdf);

  const now = new Date().toLocaleString()
  console.log(`PDF generated successfully at ${now}`)
}

await build();
