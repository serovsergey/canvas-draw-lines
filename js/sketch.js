import throttle from "./throttle.js";

export default class Sketch {
  #canvas;
  #context;
  #elements = [];
  #begin;
  #end;
  #locked;

  constructor(root) {
    this.#canvas = document.getElementById(root);
    this.#context = this.#canvas.getContext("2d");

    this.#canvas.addEventListener("mouseup", this.#handleMouseUp);
    this.#canvas.addEventListener("mousemove", this.#handleMouseMove);
  }

  #handleMouseMove = throttle((evt) => {
    if (this.#begin) {
      this.#end = { x: evt.offsetX, y: evt.offsetY };
      this.redraw();
    }
  }, 10);

  #handleMouseUp = (evt) => {
    if (this.#locked) {
      return;
    }
    switch (evt.button) {
      case 0:
        if (this.#begin) {
          this.addLine({ begin: this.#begin, end: this.#end });
          this.#begin = null;
        } else {
          this.#begin = { x: evt.offsetX, y: evt.offsetY };
          this.#end = { ...this.#begin };
        }
        break;
      case 2:
        this.#begin = null;
        this.redraw();
        break;
      default:
    }
  };

  #drawLine({ begin, end }) {
    this.#context.save();

    this.#context.beginPath();
    this.#context.moveTo(begin.x, begin.y);
    this.#context.lineTo(end.x, end.y);
    this.#context.stroke();

    this.#context.restore();
  }

  addLine = (lineParams) => {
    this.#elements.push(lineParams);
  };

  // line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
  #intersect = (
    firstBeginX,
    firstBeginY,
    firstEndX,
    firstEndY,
    secondBeginX,
    secondBeginY,
    secondEndX,
    secondEndY
  ) => {
    if (
      (firstBeginX === firstEndX && firstBeginY === firstEndY) ||
      (secondBeginX === secondEndX && secondBeginY === secondEndY)
    ) {
      return false;
    }

    const denominator =
      (secondEndY - secondBeginY) * (firstEndX - firstBeginX) -
      (secondEndX - secondBeginX) * (firstEndY - firstBeginY);

    if (denominator === 0) {
      return false;
    }

    const ua =
      ((secondEndX - secondBeginX) * (firstBeginY - secondBeginY) -
        (secondEndY - secondBeginY) * (firstBeginX - secondBeginX)) /
      denominator;
    const ub =
      ((firstEndX - firstBeginX) * (firstBeginY - secondBeginY) -
        (firstEndY - firstBeginY) * (firstBeginX - secondBeginX)) /
      denominator;

    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
      return false;
    }

    const x = firstBeginX + ua * (firstEndX - firstBeginX);
    const y = firstBeginY + ua * (firstEndY - firstBeginY);

    return { x, y };
  };

  #drawIntersectionPoint(coord) {
    this.#context.save();

    this.#context.beginPath();
    this.#context.arc(coord.x, coord.y, 4, 0, 2 * Math.PI);
    this.#context.fillStyle = "red";
    this.#context.fill();
    this.#context.stroke();

    this.#context.restore();
  }

  #drawIntersection(firstLine, secondLine) {
    const inersectionPoint = this.#intersect(
      firstLine.begin.x,
      firstLine.begin.y,
      firstLine.end.x,
      firstLine.end.y,
      secondLine.begin.x,
      secondLine.begin.y,
      secondLine.end.x,
      secondLine.end.y
    );
    if (inersectionPoint) {
      this.#drawIntersectionPoint(inersectionPoint);
    }
  }

  #drawAllIntersections() {
    for (let first = 0; first < this.#elements.length; first += 1) {
      for (
        let second = first + 1;
        second < this.#elements.length;
        second += 1
      ) {
        const firstLine = this.#elements[first];
        const secondLine = this.#elements[second];
        this.#drawIntersection(firstLine, secondLine);
      }
    }
  }

  redraw() {
    this.#context.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    if (this.#begin) {
      this.#drawLine({ begin: this.#begin, end: this.#end });
    }
    for (const line of this.#elements) {
      this.#drawLine(line);
      if (this.#begin) {
        this.#drawIntersection(line, {
          begin: { x: this.#begin.x, y: this.#begin.y },
          end: { x: this.#end.x, y: this.#end.y },
        });
      }
    }
    this.#drawAllIntersections();
  }

  collapseAll = (duration) => {
    const getDistance = ({ begin, end }) => {
      return ((begin.x - end.x) ** 2 + (begin.y - end.y) ** 2) ** 0.5;
    };
    const getLinesSteps = (divider) => {
      const result = [];
      for (const line of this.#elements) {
        const distance = getDistance(line);
        result.push(distance / divider);
      }
      return result;
    };
    const getOffsetCoords = ({ begin, end }, offset) => {
      const d = getDistance({ begin, end });
      const t = offset / 2 / d;
      const x1 = (1 - t) * begin.x + t * end.x;
      const y1 = (1 - t) * begin.y + t * end.y;
      const x2 = (1 - t) * end.x + t * begin.x;
      const y2 = (1 - t) * end.y + t * begin.y;
      return { begin: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
    };

    const linesSteps = getLinesSteps(duration);
    let start, previousTimeStamp;

    const frame = (timestamp) => {
      if (start === undefined) {
        start = timestamp;
      }
      const timeStep = timestamp - previousTimeStamp;
      if (previousTimeStamp !== timestamp) {
        for (let i = 0; i < this.#elements.length; i += 1) {
          const line = this.#elements[i];
          const newLine = getOffsetCoords(line, linesSteps[i] * timeStep || 0);
          this.#elements[i] = newLine;
          const distance = getDistance(newLine);
          if (Math.round(distance * 10) < 1) {
            this.#elements.length = 0;
            this.#locked = false;
          }
        }
        this.redraw();
      }

      if (timestamp - start < duration) {
        previousTimeStamp = timestamp;
        window.requestAnimationFrame(frame);
      }
    };
    if (this.#elements.length) {
      this.#locked = true;
      window.requestAnimationFrame(frame);
    }
  };
}
