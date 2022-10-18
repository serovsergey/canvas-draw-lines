import Sketch from "./sketch.js";

const sketch = new Sketch("canvas");
const collapseBtn = document.getElementById("collapse-button");
collapseBtn?.addEventListener("click", () => sketch?.collapseAll(3000));
