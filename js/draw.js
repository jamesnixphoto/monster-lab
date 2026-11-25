// Drawing pad. Strokes are kept as a list, so undo and redo can replay them.
// Apple Pencil uses pressure for line width. While the pencil is touching, finger touches are ignored.

export class Pad {
  constructor(canvas, onChange) {
    this.c = canvas;
    this.ctx = canvas.getContext("2d");
    this.W = canvas.width; this.H = canvas.height;
    this.onChange = onChange || (() => {});
    this.strokes = []; this.redoStack = [];
    this.base = null;            // an image bitmap of a restored unsaved drawing
    this.cur = null;
    this.color = "#111111"; this.size = 10; this.eraser = false;
    this.penDown = false; this.penTime = 0;
    this._bind();
    this.render();
  }

  _bind() {
    const c = this.c;
    c.style.touchAction = "none";
    this._down = e => this.down(e);
    this._move = e => this.move(e);
    this._up = e => this.up(e);
    c.addEventListener("pointerdown", this._down);
    c.addEventListener("pointermove", this._move);
    c.addEventListener("pointerup", this._up);
    c.addEventListener("pointercancel", this._up);
    c.addEventListener("pointerleave", e => { if (e.pointerType === "pen" && !this.cur) this.penDown = false; });
    this._ctx = e => e.preventDefault();
    c.addEventListener("contextmenu", this._ctx);
  }
  destroy() {
    const c = this.c;
    c.removeEventListener("pointerdown", this._down);
    c.removeEventListener("pointermove", this._move);
    c.removeEventListener("pointerup", this._up);
    c.removeEventListener("pointercancel", this._up);
    c.removeEventListener("contextmenu", this._ctx);
  }

  _pt(e) {
    const r = this.c.getBoundingClientRect();
    const pr = e.pointerType === "pen" ? (e.pressure > 0 ? e.pressure : 0.5) : 0.5;
    return [(e.clientX - r.left) * this.W / r.width, (e.clientY - r.top) * this.H / r.height, pr];
  }
  _w(stroke, pr) {
    if (stroke.eraser) return stroke.size * 2.5;
    return stroke.pen ? stroke.size * (0.3 + 1.4 * pr) : stroke.size;
  }

  down(e) {
    if (e.pointerType === "pen") {
      this.penDown = true; this.penTime = performance.now();
      // A palm landed first and started a stroke. Throw that stroke away.
      if (this.cur && !this.cur.pen) { this.cur = null; this.render(); }
    } else if (e.pointerType === "touch") {
      if (this.penDown || performance.now() - this.penTime < 600) return;
    }
    if (this.cur) return;
    e.preventDefault();
    try { this.c.setPointerCapture(e.pointerId); } catch (_) {}
    this.cur = { id: e.pointerId, pen: e.pointerType === "pen", color: this.color, size: this.size, eraser: this.eraser, pts: [this._pt(e)] };
    this._dot(this.cur);
  }
  move(e) {
    if (e.pointerType === "pen") this.penTime = performance.now();
    if (!this.cur || e.pointerId !== this.cur.id) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ev of (evs.length ? evs : [e])) {
      const pts = this.cur.pts;
      const a = pts[pts.length - 1], b = this._pt(ev);
      pts.push(b);
      this._seg(this.cur, a, b);
    }
  }
  up(e) {
    if (e.pointerType === "pen") { this.penDown = false; this.penTime = performance.now(); }
    if (!this.cur || e.pointerId !== this.cur.id) return;
    this.strokes.push(this.cur);
    this.redoStack = [];
    this.cur = null;
    this.onChange();
  }

  _style(s) {
    const x = this.ctx;
    x.lineCap = "round"; x.lineJoin = "round";
    x.strokeStyle = s.eraser ? "#ffffff" : s.color;
    x.fillStyle = x.strokeStyle;
  }
  _dot(s) {
    const [px, py, pr] = s.pts[0];
    this._style(s);
    this.ctx.beginPath();
    this.ctx.arc(px, py, this._w(s, pr) / 2, 0, Math.PI * 2);
    this.ctx.fill();
  }
  _seg(s, a, b) {
    this._style(s);
    const x = this.ctx;
    x.lineWidth = (this._w(s, a[2]) + this._w(s, b[2])) / 2;
    x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
  }
  render() {
    const x = this.ctx;
    x.fillStyle = "#ffffff"; x.fillRect(0, 0, this.W, this.H);
    if (this.base) x.drawImage(this.base, 0, 0, this.W, this.H);
    for (const s of this.strokes) {
      this._dot(s);
      for (let i = 1; i < s.pts.length; i++) this._seg(s, s.pts[i - 1], s.pts[i]);
    }
  }

  get isEmpty() { return !this.strokes.length && !this.base; }
  get canUndo() { return this.strokes.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  undo() { if (!this.strokes.length) return; this.redoStack.push(this.strokes.pop()); this.render(); this.onChange(); }
  redo() { if (!this.redoStack.length) return; this.strokes.push(this.redoStack.pop()); this.render(); this.onChange(); }
  clear() { this.strokes = []; this.redoStack = []; this.base = null; this.render(); this.onChange(); }
  async loadBase(blob) {
    this.base = await createImageBitmap(blob);
    this.render(); this.onChange();
  }
  toBlob() { return new Promise(res => this.c.toBlob(res, "image/png")); }
}
