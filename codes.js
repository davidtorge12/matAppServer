import { readFileSync, writeFile } from "fs";
import xlsx from "node-xlsx";

// const buf = readFileSync("codes.xlsx");
// /* buf is a Buffer */
// const { Sheets } = read(buf);
// writeFile("myjsonfile.json", JSON.stringify(Sheets), "utf8", () => {
//   console.log("done");
// });

// Parse a file
let { data: arr } = xlsx.parse(`codes.xlsx`)[1];

arr = arr.filter((row) => row[0] && row[0] > 0);

const newArr = [];

arr.map((row, i) => {
  return newArr.push({
    _id: `${i}`,
    code: row[0],
    text: row[1],
    unit: row[2],
    price: row[3],
    materials: [],
  });
});

console.log(newArr[0], newArr[1], newArr[7]);
console.log(newArr[10], newArr[9], newArr[8]);

writeFile("json2.json", JSON.stringify(""), "utf-8", () => {});
writeFile("json2.json", JSON.stringify(newArr), "utf-8", () => {});
