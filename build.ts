import { mdToPdf } from 'md-to-pdf';
import fs from 'fs';
import config from "./config.js";

const pdfpager = `<div class="page-break"></div>\n\n`;

export const build = async () => {
  console.log("Building PDF...")
  const pages = await fs.readdirSync("pages")
  const orderedPages = pages.sort((a, b) => {
    const aNum = parseInt(a.split(".")[0]);
    const bNum = parseInt(b.split(".")[0]);
    return aNum - bNum;
  })


  let content = ""
  for (let i = 0; i < orderedPages.length; i++) {
    const page = pages[i];
    const file = Bun.file(`pages/${page}`);
    const filecontentTmpl = await file.text()

    const filecontent = filecontentTmpl.replace(/{{ pagenum }}/g, i + 1);

    content += filecontent + "\n" + pdfpager;
  }

  const pdf = await mdToPdf({ content }, config)
  await Bun.write("main.pdf", pdf.content);
  console.log("PDF generated successfully")
}


await build();
