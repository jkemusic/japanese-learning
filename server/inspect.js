const axios = require("axios");
const fs = require("fs");

async function fetchPage() {
  try {
    const response = await axios.get(
      "https://www.sigure.tw/dict/jp/%E7%8C%AB",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      }
    );
    fs.writeFileSync("page.html", response.data);
    console.log("Page saved to page.html");
  } catch (error) {
    console.error("Error fetching page:", error);
  }
}

fetchPage();
