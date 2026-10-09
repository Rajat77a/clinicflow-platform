const fs = require("fs");
let code = fs.readFileSync("src/routes/setup.tsx", "utf8");
code = code.replace(
    /search=\{\{ email: [^}]+\}\}/g,
    ""
);
fs.writeFileSync("src/routes/setup.tsx", code);
console.log("Fixed setup.tsx search param");
