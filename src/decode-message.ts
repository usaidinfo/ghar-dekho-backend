import * as cheerio from "cheerio";

async function decodeSecretMessage(url: string): Promise<void> {
  const response = await fetch(url);
  const html = await response.text();

  const $ = cheerio.load(html);
  const grid: Map<string, string> = new Map();
  let maxX = 0;
  let maxY = 0;

  $("table tr").each((rowIndex, row) => {
    if (rowIndex === 0) return;

    const cells = $(row).find("td");
    if (cells.length < 3) return;

    const x = parseInt($(cells[0]).text().trim(), 10);
    const char = $(cells[1]).text().trim();
    const y = parseInt($(cells[2]).text().trim(), 10);

    if (isNaN(x) || isNaN(y)) return;

    grid.set(`${x},${y}`, char);
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  for (let y = maxY; y >= 0; y--) {
    let row = "";
    for (let x = 0; x <= maxX; x++) {
      row += grid.get(`${x},${y}`) ?? " ";
    }
    console.log(row);
  }
}

decodeSecretMessage(
  "https://docs.google.com/document/d/e/2PACX-1vTMOmshQe8YvaRXi6gEPKKlsC6UpFJSMAk4mQjLm_u1gmHdVVTaeh7nBNFBRlui0sTZ-snGwZM4DBCT/pub"
);