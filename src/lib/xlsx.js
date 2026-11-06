/* Генератор оформленного отчёта .xlsx без внешних библиотек (перенесён из Accounting; акцент — золото Aurum) */

  var C = { ink: '1A1410', muted: '6E665A', line: 'E8DFCC', card: 'FAF6EC', blue: 'B8862C', blueSoft: 'F7EEDA', green: '2F7D5B', red: 'B5503C', hero: '0F0C09', white: 'FFFFFF', amber: 'C9963A', gold: 'E8C277', goldText: 'F4DDA6', heroMuted: 'B9A27A' };
  var PALETTE = ['C9963A', '2F7D5B', '4A6FA5', 'B5503C', '8B6BB0', '3E9AA6', 'A8A29A', '6E5B3A'];
  var FONT = 'Arial';
  var WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  var MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  var FMT_MONEY = '#,##0.00\\ "₴"';
  var FMT_NUM = '#,##0.00';
  var FMT_INT = '#,##0';
  var FMT_PCT = '0.0%';
  var FMT_DT = 'dd.mm.yyyy\\ hh:mm';
  var FMT_D = 'dd.mm.yyyy';

  function esc(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function colName(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function serial(d) { return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()) - Date.UTC(1899, 11, 30)) / 6e4) / 1440; }
  function dayStart(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function ddmm(d) { return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1); }
  function ddmmyyyy(d) { return ddmm(d) + '.' + d.getFullYear(); }
  function money(n) {
    var s = Math.abs(n).toFixed(2).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    return (n < 0 ? '−' : '') + s[0] + ',' + s[1] + '\u00A0₴';
  }
  function plural(n, a, b, c) { var x = n % 10, y = n % 100; return (y >= 11 && y <= 14) ? c : x === 1 ? a : (x >= 2 && x <= 4) ? b : c; }
  function num(v) { return String(Math.round(v * 1e6) / 1e6); }

  /* ---------- ZIP (без сжатия) ---------- */
  var CRC_T = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function utf8(s) { return new TextEncoder().encode(s); }
  function zip(files) {
    var now = new Date(), dt = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    var tm = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), data = f.data, crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = 0; central.forEach(function (p) { cdSize += p.length; });
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]), total = 0;
    all.forEach(function (p) { total += p.length; });
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  /* ---------- Стили ---------- */
  function StyleBook() {
    var fonts = [], fontMap = {}, fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'],
      fillMap = {}, borders = [], borderMap = {}, fmts = [], fmtMap = {}, xfs = [], xfMap = {}, dxfs = [];
    var BUILTIN = { 'General': 0, '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, '0.00%': 10 };
    function uniq(list, map, xml) { if (map[xml] === undefined) { map[xml] = list.length; list.push(xml); } return map[xml]; }
    function side(tag, s) { return s ? '<' + tag + ' style="' + s[0] + '"><color rgb="FF' + s[1] + '"/></' + tag + '>' : '<' + tag + '/>'; }
    this.get = function (o) {
      o = o || {};
      var fx = '<font>' + (o.b ? '<b/>' : '') + (o.i ? '<i/>' : '') + '<sz val="' + (o.sz || 10) + '"/><color rgb="FF' + (o.color || C.ink) + '"/><name val="' + FONT + '"/><family val="2"/></font>';
      var f = uniq(fonts, fontMap, fx);
      var fill = o.fill ? uniq(fills, fillMap, '<fill><patternFill patternType="solid"><fgColor rgb="FF' + o.fill + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
      var b = uniq(borders, borderMap, '<border>' + side('left', o.bl) + side('right', o.br) + side('top', o.bt) + side('bottom', o.bb) + '<diagonal/></border>');
      var nf = 0;
      if (o.fmt) nf = BUILTIN[o.fmt] !== undefined ? BUILTIN[o.fmt] : 164 + uniq(fmts, fmtMap, o.fmt);
      var al = (o.h || o.v || o.wrap || o.indent) ?
        '<alignment' + (o.h ? ' horizontal="' + o.h + '"' : '') + ' vertical="' + (o.v || 'center') + '"' + (o.wrap ? ' wrapText="1"' : '') + (o.indent ? ' indent="' + o.indent + '"' : '') + '/>' : '';
      var xml = '<xf numFmtId="' + nf + '" fontId="' + f + '" fillId="' + fill + '" borderId="' + b + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"' + (al ? ' applyAlignment="1">' + al + '</xf>' : '/>');
      return uniq(xfs, xfMap, xml);
    };
    this.get({});
    this.dxf = function (xml) { dxfs.push(xml); return dxfs.length - 1; };
    this.xml = function () {
      var s = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
      if (fmts.length) s += '<numFmts count="' + fmts.length + '">' + fmts.map(function (f, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>'; }).join('') + '</numFmts>';
      s += '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts><fills count="' + fills.length + '">' + fills.join('') + '</fills><borders count="' + borders.length + '">' + borders.join('') + '</borders>';
      s += '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>';
      s += '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="' + dxfs.length + '">' + dxfs.join('') + '</dxfs></styleSheet>';
      return s;
    };
  }

  function SST() { this.list = []; this.map = {}; this.count = 0; }
  SST.prototype.idx = function (s) { this.count++; if (this.map[s] === undefined) { this.map[s] = this.list.length; this.list.push(s); } return this.map[s]; };
  SST.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' + this.count + '" uniqueCount="' + this.list.length + '">' +
      this.list.map(function (s) { return '<si><t xml:space="preserve">' + esc(s) + '</t></si>'; }).join('') + '</sst>';
  };

  /* ---------- Лист ---------- */
  function Sheet(name) { this.name = name; this.rows = {}; this.merges = []; this.cols = []; this.heights = {}; this.cf = []; this.freeze = 0; this.filter = ''; this.drawing = false; this.tab = C.blue; this.landscape = true; this.maxR = 1; this.maxC = 1; }
  Sheet.prototype.set = function (r, c, v, s, f) {
    (this.rows[r] = this.rows[r] || {})[c] = { v: v, s: s, f: f };
    if (r > this.maxR) this.maxR = r; if (c > this.maxC) this.maxC = c;
  };
  Sheet.prototype.merge = function (r1, c1, r2, c2) { this.merges.push(colName(c1) + r1 + ':' + colName(c2) + r2); };
  Sheet.prototype.xml = function (sst, noCache, selected) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
    x += '<sheetPr><tabColor rgb="FF' + this.tab + '"/><pageSetUpPr fitToPage="1"/></sheetPr>';
    x += '<dimension ref="A1:' + colName(this.maxC) + this.maxR + '"/>';
    x += '<sheetViews><sheetView showGridLines="0" workbookViewId="0"' + (selected ? ' tabSelected="1"' : '') + '>';
    if (this.freeze) x += '<pane ySplit="' + this.freeze + '" topLeftCell="A' + (this.freeze + 1) + '" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A' + (this.freeze + 1) + '" sqref="A' + (this.freeze + 1) + '"/>';
    x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18" customHeight="1"/>';
    if (this.cols.length) x += '<cols>' + this.cols.map(function (c) { return '<col min="' + c[0] + '" max="' + c[1] + '" width="' + c[2] + '" customWidth="1"/>'; }).join('') + '</cols>';
    x += '<sheetData>';
    var self = this, rowNums = Object.keys(this.rows).map(Number);
    Object.keys(this.heights).forEach(function (h) { if (rowNums.indexOf(Number(h)) < 0) rowNums.push(Number(h)); });
    rowNums.sort(function (a, b) { return a - b; });
    rowNums.forEach(function (r) {
      var cells = self.rows[r] || {};
      x += '<row r="' + r + '"' + (self.heights[r] ? ' ht="' + self.heights[r] + '" customHeight="1"' : '') + '>';
      Object.keys(cells).map(Number).sort(function (a, b) { return a - b; }).forEach(function (c) {
        var cell = cells[c], ref = colName(c) + r, s = cell.s ? ' s="' + cell.s + '"' : '', v = cell.v;
        if (cell.f !== undefined) {
          var fx = '<f>' + esc(cell.f) + '</f>';
          if (noCache) x += '<c r="' + ref + '"' + s + '>' + fx + '</c>';
          else if (typeof v === 'string') x += '<c r="' + ref + '"' + s + ' t="str">' + fx + '<v>' + esc(v) + '</v></c>';
          else x += '<c r="' + ref + '"' + s + '>' + fx + '<v>' + num(v || 0) + '</v></c>';
        } else if (v === null || v === undefined || v === '') x += '<c r="' + ref + '"' + s + '/>';
        else if (typeof v === 'number') x += '<c r="' + ref + '"' + s + '><v>' + num(v) + '</v></c>';
        else x += '<c r="' + ref + '"' + s + ' t="s"><v>' + sst.idx(String(v)) + '</v></c>';
      });
      x += '</row>';
    });
    x += '</sheetData>';
    if (this.filter) x += '<autoFilter ref="' + this.filter + '"/>';
    if (this.merges.length) x += '<mergeCells count="' + this.merges.length + '">' + this.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
    this.cf.forEach(function (c) { x += c; });
    x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
    x += '<pageSetup paperSize="9" orientation="' + (this.landscape ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/>';
    if (this.drawing) x += '<drawing r:id="rId1"/>';
    return x + '</worksheet>';
  };

  /* ---------- Диаграммы ---------- */
  function txPr(sz, color, bold) {
    return '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="' + sz + '" b="' + (bold ? 1 : 0) + '"><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill><a:latin typeface="' + FONT + '"/></a:defRPr></a:pPr><a:endParaRPr lang="ru-RU"/></a:p></c:txPr>';
  }
  function strRef(f, arr) {
    return '<c:strRef><c:f>' + esc(f) + '</c:f><c:strCache><c:ptCount val="' + arr.length + '"/>' + arr.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + esc(v) + '</c:v></c:pt>'; }).join('') + '</c:strCache></c:strRef>';
  }
  function numRef(f, arr) {
    return '<c:numRef><c:f>' + esc(f) + '</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="' + arr.length + '"/>' + arr.map(function (v, i) { return '<c:pt idx="' + i + '"><c:v>' + num(v) + '</c:v></c:pt>'; }).join('') + '</c:numCache></c:numRef>';
  }
  function title(t) {
    return '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1100" b="1"/></a:pPr><a:r><a:rPr lang="ru-RU" sz="1100" b="1"><a:solidFill><a:srgbClr val="' + C.ink + '"/></a:solidFill><a:latin typeface="' + FONT + '"/></a:rPr><a:t>' + esc(t) + '</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>';
  }
  var CHART_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>';
  var CHART_TAIL = '<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="' + C.line + '"/></a:solidFill></a:ln></c:spPr>' + txPr(900, C.muted, false).replace('<c:txPr>', '<c:txPr>') + '</c:chartSpace>';
  var NOLBL = '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/>';

  function barChart(o) { // o: title, horizontal, cat:{f,vals}, series:[{name,nameF,f,vals,color}], labels, legend, fmt
    var ser = o.series.map(function (s, i) {
      return '<c:ser><c:idx val="' + i + '"/><c:order val="' + i + '"/><c:tx>' + strRef(s.nameF, [s.name]) + '</c:tx><c:spPr><a:solidFill><a:srgbClr val="' + s.color + '"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/>' +
        (o.labels ? '<c:dLbls><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:spPr><a:noFill/></c:spPr>' + txPr(800, C.muted, false) + '<c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>' : '') +
        '<c:cat>' + (o.cat.numeric ? numRef(o.cat.f, o.cat.vals) : strRef(o.cat.f, o.cat.vals)) + '</c:cat><c:val>' + numRef(s.f, s.vals) + '</c:val></c:ser>';
    }).join('');
    var h = !!o.horizontal;
    return CHART_HEAD + title(o.title) + '<c:plotArea><c:layout/><c:barChart><c:barDir val="' + (h ? 'bar' : 'col') + '"/><c:grouping val="clustered"/><c:varyColors val="0"/>' + ser +
      '<c:gapWidth val="' + (o.gap || 60) + '"/>' + (o.series.length > 1 ? '<c:overlap val="-5"/>' : '') + '<c:axId val="5001"/><c:axId val="5002"/></c:barChart>' +
      '<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="' + (h ? 'maxMin' : 'minMax') + '"/></c:scaling><c:delete val="0"/><c:axPos val="' + (h ? 'l' : 'b') + '"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="D1D1D6"/></a:solidFill></a:ln></c:spPr>' + txPr(800, C.muted, false) + '<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>' +
      '<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="' + (h ? 1 : 0) + '"/><c:axPos val="' + (h ? 't' : 'l') + '"/>' + (h ? '' : '<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="' + C.line + '"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>') +
      '<c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>' + txPr(800, C.muted, false) + '<c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx><c:spPr><a:noFill/></c:spPr></c:plotArea>' +
      (o.legend ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/>' + txPr(900, C.muted, false) + '</c:legend>' : '') + CHART_TAIL;
  }

  function doughnutChart(o) { // title, cat:{f,vals}, ser:{name,nameF,f,vals}
    var pts = o.ser.vals.map(function (v, i) { return '<c:dPt><c:idx val="' + i + '"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="' + PALETTE[i % PALETTE.length] + '"/></a:solidFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>'; }).join('');
    return CHART_HEAD + title(o.title) + '<c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/><c:tx>' + strRef(o.ser.nameF, [o.ser.name]) + '</c:tx>' + pts +
      '<c:dLbls><c:numFmt formatCode="0%" sourceLinked="0"/><c:spPr><a:noFill/></c:spPr>' + txPr(800, 'FFFFFF', true) + '<c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="0"/></c:dLbls>' +
      '<c:cat>' + strRef(o.cat.f, o.cat.vals) + '</c:cat><c:val>' + numRef(o.ser.f, o.ser.vals) + '</c:val></c:ser><c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart><c:spPr><a:noFill/></c:spPr></c:plotArea>' +
      '<c:legend><c:legendPos val="r"/><c:overlay val="0"/>' + txPr(900, C.ink, false) + '</c:legend>' + CHART_TAIL;
  }

  function anchorXml(i, c1, r1, c2, r2) {
    return '<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>' + c1 + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + r1 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>' + c2 + '</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>' + r2 + '</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>' +
      '<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="' + (i + 1) + '" name="Диаграмма ' + i + '"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId' + i + '"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>';
  }

  /* ---------- Основная сборка ---------- */
  function buildReportXlsx(model, opts) {
    opts = opts || {};
    var rows = model.rows.map(function (r) {
      var d = r.date;
      return { date: d, action: r.action, amt: Math.abs(Number(r.amount) || 0), cur: r.currency || '', cat: r.category || (r.action === 'Перевод' ? '' : 'Без категории'), acc: r.account || '', from: r.from || '', to: r.to || '', note: r.note || '', src: r.source || '', wd: WD[(d.getDay() + 6) % 7], month: d.getFullYear() + '-' + pad2(d.getMonth() + 1), ser: serial(d) };
    }).sort(function (a, b) { return a.date - b.date; });
    var n = rows.length, N = n + 1;
    var sb = new StyleBook(), sst = new SST();
    var S = function (o) { return sb.get(o); };
    var ops = new Sheet('Операции'), sum = new Sheet('Сводка');
    ops.tab = C.gold;
    function R(col) { return 'Операции!$' + col + '$2:$' + col + '$' + N; }
    function sumIf(fn) { var s = 0; rows.forEach(function (r) { if (fn(r)) s += r.amt; }); return s; }
    function cntIf(fn) { var s = 0; rows.forEach(function (r) { if (fn(r)) s++; }); return s; }
    var charts = [];

    /* ===== Лист «Операции» ===== */
    var heads = ['Дата', 'Тип', 'Сумма', 'Валюта', 'Категория', 'Счёт', 'Со счёта', 'На счёт', 'Заметка', 'Источник', 'Месяц', 'День недели'];
    var widths = [17, 10, 13, 8, 28, 18, 16, 16, 42, 11, 10, 13];
    widths.forEach(function (w, i) { ops.cols.push([i + 1, i + 1, w]); });
    var hs = S({ b: 1, sz: 9, color: C.goldText, fill: C.hero, v: 'center', indent: 1 });
    heads.forEach(function (h, i) { ops.set(1, i + 1, h, hs); });
    ops.heights[1] = 26;
    var bb = ['thin', C.line];
    var sDt = S({ fmt: FMT_DT, bb: bb, h: 'left', indent: 1 }), sTx = S({ bb: bb, indent: 1 }), sAm = S({ fmt: FMT_NUM, bb: bb, b: 1 }), sMu = S({ bb: bb, color: C.muted, indent: 1 });
    rows.forEach(function (r, i) {
      var k = i + 2;
      ops.set(k, 1, r.ser, sDt); ops.set(k, 2, r.action, sTx); ops.set(k, 3, r.amt, sAm); ops.set(k, 4, r.cur, sMu);
      ops.set(k, 5, r.cat, sTx); ops.set(k, 6, r.acc, sTx); ops.set(k, 7, r.from, sTx); ops.set(k, 8, r.to, sTx);
      ops.set(k, 9, r.note, sTx); ops.set(k, 10, r.src, sMu); ops.set(k, 11, r.month, sMu); ops.set(k, 12, r.wd, sMu);
    });
    ops.freeze = 1; ops.filter = 'A1:L' + N; ops.landscape = true;
    var dRed = sb.dxf('<dxf><font><b/><color rgb="FF' + C.red + '"/></font></dxf>'), dGreen = sb.dxf('<dxf><font><b/><color rgb="FF' + C.green + '"/></font></dxf>'),
      dBlue = sb.dxf('<dxf><font><b/><color rgb="FF' + C.blue + '"/></font></dxf>'), dGray = sb.dxf('<dxf><font><b/><color rgb="FF' + C.muted + '"/></font></dxf>');
    var pr = 1;
    ops.cf.push('<conditionalFormatting sqref="B2:B' + N + '">' + [['Расход', dRed], ['Доход', dGreen], ['Возврат', dBlue], ['Перевод', dGray]].map(function (p) {
      return '<cfRule type="cellIs" dxfId="' + p[1] + '" priority="' + (pr++) + '" operator="equal"><formula>"' + p[0] + '"</formula></cfRule>';
    }).join('') + '</conditionalFormatting>');

    /* ===== Лист «Сводка» ===== */
    sum.cols.push([1, 1, 2]); sum.cols.push([2, 13, 12.7]); sum.cols.push([14, 14, 2]);
    var income = sumIf(function (r) { return r.action === 'Доход'; });
    var expGross = sumIf(function (r) { return r.action === 'Расход'; });
    var retSum = sumIf(function (r) { return r.action === 'Возврат'; });
    var expense = expGross - retSum, result = income - expense;
    var cntExp = cntIf(function (r) { return r.action === 'Расход'; });
    var cntTr = cntIf(function (r) { return r.action === 'Перевод'; });
    var maxExp = 0, maxRow = null; rows.forEach(function (r) { if (r.action === 'Расход' && r.amt > maxExp) { maxExp = r.amt; maxRow = r; } });
    var days = model.daysForAvg || 1;
    var gen = model.generatedAt || new Date();

    var heroS = function (o) { o = o || {}; o.fill = C.hero; o.color = o.color || C.white; return S(o); };
    sum.heights[1] = 8;
    for (var c = 2; c <= 13; c++) { sum.set(2, c, '', heroS()); sum.set(3, c, '', heroS()); sum.set(4, c, '', S({ fill: C.gold })); }
    sum.set(2, 2, 'AURUM  ·  Финансовый отчёт', heroS({ sz: 20, b: 1, indent: 1, color: C.goldText })); sum.merge(2, 2, 2, 13); sum.heights[2] = 38;
    sum.set(3, 2, 'Период: ' + model.periodLabel + '   ·   ' + model.accountLabel + '   ·   Сформирован ' + ddmmyyyy(gen) + ' ' + pad2(gen.getHours()) + ':' + pad2(gen.getMinutes()), heroS({ sz: 10, color: C.heroMuted, indent: 1 })); sum.merge(3, 2, 3, 13); sum.heights[3] = 24;
    sum.merge(4, 2, 4, 13); sum.heights[4] = 4; sum.heights[5] = 12;

    var W = ['thick', C.white];
    function card(r, c0, accent, label, formula, cached, fmt, sub) {
      for (var i = 0; i < 3; i++) {
        for (var k = 0; k < 3; k++) {
          var o = { fill: C.card };
          if (k === 0) o.bl = W; if (k === 2) o.br = W;
          var v = '', f = undefined;
          if (i === 0) { o.sz = 8; o.b = 1; o.color = C.muted; o.bt = ['medium', accent]; o.indent = 1; if (k === 0) v = label.toUpperCase(); }
          if (i === 1) { o.sz = 20; o.b = 1; o.fmt = fmt; o.h = 'left'; o.indent = 1; if (k === 0) { v = cached; f = formula; } }
          if (i === 2) { o.sz = 9; o.color = C.muted; o.indent = 1; if (k === 0) v = sub; }
          sum.set(r + i, c0 + k, v, S(o), k === 0 ? f : undefined);
        }
        sum.merge(r + i, c0, r + i, c0 + 2);
      }
      sum.heights[r] = 22; sum.heights[r + 1] = 36; sum.heights[r + 2] = 20;
    }
    var EXP_F = 'SUMIFS(' + R('C') + ',' + R('B') + ',"Расход")-SUMIFS(' + R('C') + ',' + R('B') + ',"Возврат")';
    var INC_F = 'SUMIFS(' + R('C') + ',' + R('B') + ',"Доход")';
    var cntInc = cntIf(function (r) { return r.action === 'Доход'; });
    card(6, 2, C.green, 'Доходы', INC_F, income, FMT_MONEY, cntInc + ' ' + plural(cntInc, 'поступление', 'поступления', 'поступлений'));
    card(6, 5, C.red, 'Расходы', EXP_F, expense, FMT_MONEY, 'с учётом возвратов ' + money(retSum));
    card(6, 8, C.blue, 'Результат', 'B7-E7', result, FMT_MONEY, income >= expense ? 'доходы превышают расходы' : 'расходы превышают доходы');
    card(6, 11, C.amber, 'Норма сбережений', 'IF(B7=0,0,H7/B7)', income ? result / income : 0, FMT_PCT, 'доля дохода, которую удалось сохранить');
    sum.heights[9] = 10;
    card(10, 2, C.blue, 'Операций', 'COUNT(' + R('A') + ')', n, FMT_INT, 'из них переводов между счетами: ' + cntTr);
    card(10, 5, C.red, 'Расход в день', 'E7/' + days, expense / days, FMT_MONEY, 'в среднем за ' + days + ' ' + plural(days, 'день', 'дня', 'дней'));
    card(10, 8, C.amber, 'Средний чек', 'IFERROR(SUMIFS(' + R('C') + ',' + R('B') + ',"Расход")/COUNTIFS(' + R('B') + ',"Расход"),0)', cntExp ? expGross / cntExp : 0, FMT_MONEY, cntExp + ' ' + plural(cntExp, 'покупка', 'покупки', 'покупок'));
    card(10, 11, C.red, 'Крупнейший расход', 'SUMPRODUCT(MAX((' + R('B') + '="Расход")*' + R('C') + '))', maxExp, FMT_MONEY, maxRow ? (maxRow.note || maxRow.cat || '—').slice(0, 34) : '—');
    sum.heights[13] = 14;

    /* --- заготовки для секций --- */
    var row = 14, chartNo = 0, drawAnchors = [];
    var csh = sum, curCh = { xml: charts, anch: drawAnchors }, secEnd = 13;   // лист, с которым сейчас работают помощники
    function section(r, text) {
      for (var c = 2; c <= secEnd; c++) csh.set(r, c, '', S({ bb: ['medium', C.blue] }));
      csh.set(r, 2, text, S({ sz: 13, b: 1, bb: ['medium', C.blue] })); csh.merge(r, 2, r, secEnd); csh.heights[r] = 28;
    }
    var thS = function (h, w) { return S({ b: 1, sz: 9, color: C.blue, fill: C.blueSoft, h: h || 'left', indent: h === 'right' ? 0 : 1, wrap: w }); };
    function head(r, c0, cols, tall) { // cols: [{label, span, h}]; tall = двухстрочный заголовок
      var c = c0;
      cols.forEach(function (col) {
        for (var k = 0; k < col.span; k++) csh.set(r, c + k, k === 0 ? col.label : '', thS(col.h, tall));
        if (col.span > 1) csh.merge(r, c, r, c + col.span - 1);
        c += col.span;
      });
      csh.heights[r] = tall ? 34 : 22;
    }
    function cell(r, c, span, v, o, f) {
      o = o || {}; o.bb = o.bb || ['thin', C.line]; if (o.h === 'right') { o.indent = 0; } else if (!o.indent) o.indent = 1;
      var st = S(o);
      for (var k = 0; k < span; k++) csh.set(r, c + k, k === 0 ? v : '', st, k === 0 ? f : undefined);
      if (span > 1) csh.merge(r, c, r, c + span - 1);
    }
    function addChart(xml, c1, r1, c2, r2) { curCh.xml.push(xml); curCh.anch.push([c1, r1, c2, r2]); }
    var CH_ROWS = 17;

    /* ===== 1. Динамика ===== */
    var spanDays = Math.max(1, Math.round((model.end - model.start) / 864e5));
    var gran = spanDays <= 62 ? 'day' : spanDays <= 200 ? 'week' : 'month';
    var buckets = [], cur;
    if (gran === 'day') { for (cur = dayStart(model.start); cur < model.end; cur = addDays(cur, 1)) buckets.push({ s: cur, e: addDays(cur, 1), label: ddmm(cur) }); }
    else if (gran === 'week') {
      cur = dayStart(model.start); cur = addDays(cur, -((cur.getDay() + 6) % 7));
      for (; cur < model.end; cur = addDays(cur, 7)) buckets.push({ s: cur, e: addDays(cur, 7), label: ddmm(cur) + '–' + ddmm(addDays(cur, 6)) });
    } else {
      cur = new Date(model.start.getFullYear(), model.start.getMonth(), 1);
      for (; cur < model.end; cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)) buckets.push({ s: cur, e: new Date(cur.getFullYear(), cur.getMonth() + 1, 1), label: MON[cur.getMonth()] + ' ' + cur.getFullYear() });
    }
    var granTitle = { day: 'по дням', week: 'по неделям', month: 'по месяцам' }[gran];
    section(row, 'Динамика ' + granTitle);
    var hdr = row + 1;
    head(hdr, 2, [{ label: 'Период', span: 2 }, { label: 'Доходы', span: 1, h: 'right' }, { label: 'Расходы', span: 1, h: 'right' }, { label: 'Результат', span: 1, h: 'right' }, { label: 'Нараст. итог', span: 1, h: 'right' }]);
    var r0 = hdr + 1, acc = 0, incV = [], expV = [], labs = [];
    var money0 = { fmt: FMT_NUM, h: 'right' };
    buckets.forEach(function (b, i) {
      var r = r0 + i;
      var inB = function (x) { return x.date >= b.s && x.date < b.e; };
      var bi = sumIf(function (x) { return x.action === 'Доход' && inB(x); });
      var be = sumIf(function (x) { return x.action === 'Расход' && inB(x); }) - sumIf(function (x) { return x.action === 'Возврат' && inB(x); });
      acc += bi - be; incV.push(bi); expV.push(be); labs.push(b.label);
      var crit = R('A') + ',">=' + serial(b.s) + '",' + R('A') + ',"<' + serial(b.e) + '"';
      cell(r, 2, 2, b.label, { color: C.muted });
      cell(r, 4, 1, bi, { fmt: FMT_NUM, h: 'right', color: C.green }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Доход",' + crit + ')');
      cell(r, 5, 1, be, { fmt: FMT_NUM, h: 'right', color: C.red }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Расход",' + crit + ')-SUMIFS(' + R('C') + ',' + R('B') + ',"Возврат",' + crit + ')');
      cell(r, 6, 1, bi - be, { fmt: FMT_NUM, h: 'right', b: 1 }, 'D' + r + '-E' + r);
      cell(r, 7, 1, acc, { fmt: FMT_NUM, h: 'right', color: C.muted }, i === 0 ? 'F' + r : 'G' + (r - 1) + '+F' + r);
    });
    var rl = r0 + buckets.length - 1, rt = rl + 1;
    var tS = { b: 1, bt: ['thin', C.ink], bb: ['thin', C.ink], fill: C.card };
    cell(rt, 2, 2, 'Итого', Object.assign({}, tS));
    cell(rt, 4, 1, income, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(D' + r0 + ':D' + rl + ')');
    cell(rt, 5, 1, expense, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(E' + r0 + ':E' + rl + ')');
    cell(rt, 6, 1, result, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(F' + r0 + ':F' + rl + ')');
    cell(rt, 7, 1, '', Object.assign({ h: 'right' }, tS));
    var dResPos = sb.dxf('<dxf><font><color rgb="FF' + C.green + '"/></font></dxf>'), dResNeg = sb.dxf('<dxf><font><color rgb="FF' + C.red + '"/></font></dxf>');
    sum.cf.push('<conditionalFormatting sqref="F' + r0 + ':G' + rt + '"><cfRule type="cellIs" dxfId="' + dResNeg + '" priority="' + (pr++) + '" operator="lessThan"><formula>0</formula></cfRule><cfRule type="cellIs" dxfId="' + dResPos + '" priority="' + (pr++) + '" operator="greaterThan"><formula>0</formula></cfRule></conditionalFormatting>');
    chartNo++;
    addChart(barChart({
      title: 'Доходы и расходы ' + granTitle, legend: true, gap: gran === 'day' ? 40 : 70,
      cat: { f: 'Сводка!$B$' + r0 + ':$B$' + rl, vals: labs },
      series: [{ name: 'Доходы', nameF: 'Сводка!$D$' + hdr, f: 'Сводка!$D$' + r0 + ':$D$' + rl, vals: incV, color: C.green }, { name: 'Расходы', nameF: 'Сводка!$E$' + hdr, f: 'Сводка!$E$' + r0 + ':$E$' + rl, vals: expV, color: 'C9963A' }]
    }), 8, hdr - 1, 13, hdr - 1 + CH_ROWS);
    row = Math.max(rt, hdr + CH_ROWS - 1) + 2;

    /* ===== 2. Категории расходов ===== */
    var cats = {}; rows.forEach(function (r) {
      if (r.action !== 'Расход' && r.action !== 'Возврат') return;
      var k = r.cat || 'Без категории'; cats[k] = cats[k] || { e: 0, r: 0 };
      if (r.action === 'Расход') cats[k].e += r.amt; else cats[k].r += r.amt;
    });
    var catList = Object.keys(cats).map(function (k) { return { name: k, e: cats[k].e, r: cats[k].r, net: cats[k].e - cats[k].r }; }).sort(function (a, b) { return b.net - a.net; });
    // в таблице: если категории пустой — фиксируем как «Без категории»
    if (catList.length) {
      section(row, 'Расходы по категориям');
      var ch = row + 1;
      head(ch, 2, [{ label: 'Категория', span: 2 }, { label: 'Расход', span: 1, h: 'right' }, { label: 'Возвраты', span: 1, h: 'right' }, { label: 'Итого', span: 1, h: 'right' }, { label: 'Доля', span: 1, h: 'right' }]);
      var c0r = ch + 1, cl = c0r + catList.length - 1, ct = cl + 1, totNet = catList.reduce(function (s, x) { return s + x.net; }, 0);
      catList.forEach(function (x, i) {
        var r = c0r + i;
        cell(r, 2, 2, x.name, {});
        cell(r, 4, 1, x.e, money0, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Расход",' + R('E') + ',B' + r + ')');
        cell(r, 5, 1, x.r, { fmt: FMT_NUM, h: 'right', color: C.muted }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Возврат",' + R('E') + ',B' + r + ')');
        cell(r, 6, 1, x.net, { fmt: FMT_NUM, h: 'right', b: 1 }, 'D' + r + '-E' + r);
        cell(r, 7, 1, totNet ? x.net / totNet : 0, { fmt: FMT_PCT, h: 'right', color: C.muted }, 'IF(F$' + ct + '=0,0,F' + r + '/F$' + ct + ')');
      });
      cell(ct, 2, 2, 'Итого', Object.assign({}, tS));
      cell(ct, 4, 1, catList.reduce(function (s, x) { return s + x.e; }, 0), Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(D' + c0r + ':D' + cl + ')');
      cell(ct, 5, 1, catList.reduce(function (s, x) { return s + x.r; }, 0), Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(E' + c0r + ':E' + cl + ')');
      cell(ct, 6, 1, totNet, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(F' + c0r + ':F' + cl + ')');
      cell(ct, 7, 1, totNet ? 1 : 0, Object.assign({ fmt: FMT_PCT, h: 'right' }, tS), 'SUM(G' + c0r + ':G' + cl + ')');
      sum.cf.push('<conditionalFormatting sqref="F' + c0r + ':F' + cl + '"><cfRule type="dataBar" priority="' + (pr++) + '"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FFF0D9A6"/></dataBar></cfRule></conditionalFormatting>');
      var top = catList.slice(0, 8);
      chartNo++;
      addChart(doughnutChart({
        title: 'Структура расходов (топ-' + top.length + ')',
        cat: { f: 'Сводка!$B$' + c0r + ':$B$' + (c0r + top.length - 1), vals: top.map(function (x) { return x.name; }) },
        ser: { name: 'Итого', nameF: 'Сводка!$F$' + ch, f: 'Сводка!$F$' + c0r + ':$F$' + (c0r + top.length - 1), vals: top.map(function (x) { return x.net; }) }
      }), 8, ch - 1, 13, ch - 1 + CH_ROWS);
      row = Math.max(ct, ch + CH_ROWS - 1) + 2;
    }

    /* ===== 3. Доходы по категориям ===== */
    var incCats = {}; rows.forEach(function (r) { if (r.action !== 'Доход') return; var k = r.cat || 'Без категории'; incCats[k] = incCats[k] || { s: 0, n: 0 }; incCats[k].s += r.amt; incCats[k].n++; });
    var incList = Object.keys(incCats).map(function (k) { return { name: k, s: incCats[k].s, n: incCats[k].n }; }).sort(function (a, b) { return b.s - a.s; });
    if (incList.length) {
      section(row, 'Источники дохода');
      var ih = row + 1;
      head(ih, 2, [{ label: 'Категория', span: 2 }, { label: 'Сумма', span: 1, h: 'right' }, { label: 'Операций', span: 1, h: 'right' }, { label: 'Доля', span: 1, h: 'right' }]);
      var i0 = ih + 1, il = i0 + incList.length - 1, it = il + 1;
      incList.forEach(function (x, i) {
        var r = i0 + i;
        cell(r, 2, 2, x.name, {});
        cell(r, 4, 1, x.s, { fmt: FMT_NUM, h: 'right', b: 1, color: C.green }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Доход",' + R('E') + ',B' + r + ')');
        cell(r, 5, 1, x.n, { fmt: FMT_INT, h: 'right', color: C.muted }, 'COUNTIFS(' + R('B') + ',"Доход",' + R('E') + ',B' + r + ')');
        cell(r, 6, 1, income ? x.s / income : 0, { fmt: FMT_PCT, h: 'right', color: C.muted }, 'IF(D$' + it + '=0,0,D' + r + '/D$' + it + ')');
      });
      cell(it, 2, 2, 'Итого', Object.assign({}, tS));
      cell(it, 4, 1, income, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(D' + i0 + ':D' + il + ')');
      cell(it, 5, 1, incList.reduce(function (s, x) { return s + x.n; }, 0), Object.assign({ fmt: FMT_INT, h: 'right' }, tS), 'SUM(E' + i0 + ':E' + il + ')');
      cell(it, 6, 1, income ? 1 : 0, Object.assign({ fmt: FMT_PCT, h: 'right' }, tS), 'SUM(F' + i0 + ':F' + il + ')');
      sum.cf.push('<conditionalFormatting sqref="D' + i0 + ':D' + il + '"><cfRule type="dataBar" priority="' + (pr++) + '"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FFB9D9C7"/></dataBar></cfRule></conditionalFormatting>');
      row = it + 2;
    }

    /* ===== 4. По дням недели ===== */
    if (expGross > 0) {
      section(row, 'Расходы по дням недели');
      var wh = row + 1;
      head(wh, 2, [{ label: 'День', span: 2 }, { label: 'Расходы', span: 1, h: 'right' }, { label: 'Операций', span: 1, h: 'right' }, { label: 'Средний чек', span: 1, h: 'right' }, { label: 'Доля', span: 1, h: 'right' }]);
      var w0 = wh + 1, wl = w0 + 6, wt = wl + 1, wv = [], wNet = 0, peak = 0, peakI = 0;
      WD.forEach(function (d, i) {
        var g = sumIf(function (x) { return x.action === 'Расход' && x.wd === d; }), rt2 = sumIf(function (x) { return x.action === 'Возврат' && x.wd === d; }), cn = cntIf(function (x) { return x.action === 'Расход' && x.wd === d; });
        wv.push(g - rt2); wNet += g - rt2; if (g - rt2 > peak) { peak = g - rt2; peakI = i; }
        var r = w0 + i;
        cell(r, 2, 2, d, { b: 1 });
        cell(r, 4, 1, g - rt2, money0, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Расход",' + R('L') + ',B' + r + ')-SUMIFS(' + R('C') + ',' + R('B') + ',"Возврат",' + R('L') + ',B' + r + ')');
        cell(r, 5, 1, cn, { fmt: FMT_INT, h: 'right', color: C.muted }, 'COUNTIFS(' + R('B') + ',"Расход",' + R('L') + ',B' + r + ')');
        cell(r, 6, 1, cn ? g / cn : 0, { fmt: FMT_NUM, h: 'right', color: C.muted }, 'IF(E' + r + '=0,0,SUMIFS(' + R('C') + ',' + R('B') + ',"Расход",' + R('L') + ',B' + r + ')/E' + r + ')');
        cell(r, 7, 1, 0, { fmt: FMT_PCT, h: 'right', color: C.muted }, 'IF(D$' + wt + '=0,0,D' + r + '/D$' + wt + ')');
      });
      WD.forEach(function (d, i) { sum.rows[w0 + i][7].v = wNet ? wv[i] / wNet : 0; });
      cell(wt, 2, 2, 'Итого', Object.assign({}, tS));
      cell(wt, 4, 1, wNet, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(D' + w0 + ':D' + wl + ')');
      cell(wt, 5, 1, cntExp, Object.assign({ fmt: FMT_INT, h: 'right' }, tS), 'SUM(E' + w0 + ':E' + wl + ')');
      cell(wt, 6, 1, '', Object.assign({ h: 'right' }, tS)); cell(wt, 7, 1, wNet ? 1 : 0, Object.assign({ fmt: FMT_PCT, h: 'right' }, tS), 'SUM(G' + w0 + ':G' + wl + ')');
      sum.set(wt + 1, 2, 'Больше всего вы тратите в: ' + WD[peakI] + ' (' + money(peak) + ')', S({ i: 1, color: C.muted, sz: 9, indent: 1 })); sum.merge(wt + 1, 2, wt + 1, 7);
      sum.cf.push('<conditionalFormatting sqref="D' + w0 + ':D' + wl + '"><cfRule type="dataBar" priority="' + (pr++) + '"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FFF0D9A6"/></dataBar></cfRule></conditionalFormatting>');
      chartNo++;
      addChart(barChart({
        title: 'Расходы по дням недели', gap: 50, labels: true,
        cat: { f: 'Сводка!$B$' + w0 + ':$B$' + wl, vals: WD.slice() },
        series: [{ name: 'Расходы', nameF: 'Сводка!$D$' + wh, f: 'Сводка!$D$' + w0 + ':$D$' + wl, vals: wv, color: C.blue }]
      }), 8, wh - 1, 13, wh - 1 + 13);
      row = Math.max(wt + 1, wh + 13 - 1) + 2;
    }

    /* ===== 5. Топ мест трат ===== */
    var mer = {}; rows.forEach(function (r) { if (r.action !== 'Расход') return; var k = r.note || '(без описания)'; mer[k] = mer[k] || { s: 0, n: 0 }; mer[k].s += r.amt; mer[k].n++; });
    var merList = Object.keys(mer).map(function (k) { return { name: k, s: mer[k].s, n: mer[k].n }; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 10);
    if (merList.length) {
      section(row, 'Куда уходят деньги: топ-10 мест');
      var mh = row + 1;
      head(mh, 2, [{ label: 'Место / описание', span: 3 }, { label: 'Сумма', span: 1, h: 'right' }, { label: 'Операций', span: 1, h: 'right' }, { label: 'Доля', span: 1, h: 'right' }]);
      var m0 = mh + 1, ml = m0 + merList.length - 1;
      merList.forEach(function (x, i) {
        var r = m0 + i;
        cell(r, 2, 3, x.name, {}); cell(r, 5, 1, x.s, { fmt: FMT_NUM, h: 'right', b: 1 });
        cell(r, 6, 1, x.n, { fmt: FMT_INT, h: 'right', color: C.muted }); cell(r, 7, 1, expGross ? x.s / expGross : 0, { fmt: FMT_PCT, h: 'right', color: C.muted });
      });
      sum.set(ml + 1, 2, 'Суммы по заметке операции, без учёта возвратов; доля — от всех расходов.', S({ i: 1, color: C.muted, sz: 9, indent: 1 })); sum.merge(ml + 1, 2, ml + 1, 7);
      sum.cf.push('<conditionalFormatting sqref="E' + m0 + ':E' + ml + '"><cfRule type="dataBar" priority="' + (pr++) + '"><dataBar><cfvo type="num" val="0"/><cfvo type="max"/><color rgb="FFF0D9A6"/></dataBar></cfRule></conditionalFormatting>');
      chartNo++;
      addChart(barChart({
        title: 'Топ мест трат', horizontal: true, gap: 40, labels: true,
        cat: { f: 'Сводка!$B$' + m0 + ':$B$' + ml, vals: merList.map(function (x) { return x.name; }) },
        series: [{ name: 'Сумма', nameF: 'Сводка!$E$' + mh, f: 'Сводка!$E$' + m0 + ':$E$' + ml, vals: merList.map(function (x) { return x.s; }), color: C.blue }]
      }), 8, mh - 1, 13, mh - 1 + 15);
      row = Math.max(ml + 1, mh + 15 - 1) + 2;
    }

    /* ===== 6. Крупнейшие расходы ===== */
    var big = rows.filter(function (r) { return r.action === 'Расход'; }).sort(function (a, b) { return b.amt - a.amt; }).slice(0, 10);
    if (big.length) {
      section(row, 'Крупнейшие расходы');
      var bh = row + 1;
      head(bh, 2, [{ label: 'Дата', span: 1 }, { label: 'Описание', span: 4 }, { label: 'Категория', span: 3 }, { label: 'Счёт', span: 2 }, { label: 'Сумма', span: 2, h: 'right' }]);
      big.forEach(function (x, i) {
        var r = bh + 1 + i;
        cell(r, 2, 1, x.ser, { fmt: FMT_D, h: 'left', color: C.muted }); cell(r, 3, 4, x.note || '—', {}); cell(r, 7, 3, x.cat || 'Без категории', { color: C.muted });
        cell(r, 10, 2, x.acc, { color: C.muted }); cell(r, 12, 2, x.amt, { fmt: FMT_MONEY, h: 'right', b: 1, color: C.red });
      });
      row = bh + big.length + 2;
    }

    /* ===== 7. По счетам ===== */
    var accs = {}; rows.forEach(function (r) { if (r.action === 'Перевод' || !r.acc) return; accs[r.acc] = accs[r.acc] || { i: 0, e: 0, r: 0, n: 0 }; var a = accs[r.acc]; a.n++; if (r.action === 'Доход') a.i += r.amt; else if (r.action === 'Расход') a.e += r.amt; else if (r.action === 'Возврат') a.r += r.amt; });
    var accList = Object.keys(accs).map(function (k) { return { name: k, i: accs[k].i, e: accs[k].e - accs[k].r, n: accs[k].n }; }).sort(function (a, b) { return b.e - a.e; });
    if (accList.length > 1) {
      section(row, 'По счетам');
      var ah = row + 1;
      head(ah, 2, [{ label: 'Счёт', span: 2 }, { label: 'Доходы', span: 1, h: 'right' }, { label: 'Расходы', span: 1, h: 'right' }, { label: 'Результат', span: 1, h: 'right' }, { label: 'Операций', span: 1, h: 'right' }]);
      accList.forEach(function (x, i) {
        var r = ah + 1 + i;
        cell(r, 2, 2, x.name, { b: 1 });
        cell(r, 4, 1, x.i, { fmt: FMT_NUM, h: 'right', color: C.green }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Доход",' + R('F') + ',B' + r + ')');
        cell(r, 5, 1, x.e, { fmt: FMT_NUM, h: 'right', color: C.red }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Расход",' + R('F') + ',B' + r + ')-SUMIFS(' + R('C') + ',' + R('B') + ',"Возврат",' + R('F') + ',B' + r + ')');
        cell(r, 6, 1, x.i - x.e, { fmt: FMT_NUM, h: 'right', b: 1 }, 'D' + r + '-E' + r);
        cell(r, 7, 1, x.n, { fmt: FMT_INT, h: 'right', color: C.muted }, 'COUNTIFS(' + R('F') + ',B' + r + ',' + R('B') + ',"<>Перевод")');
      });
      sum.cf.push('<conditionalFormatting sqref="F' + (ah + 1) + ':F' + (ah + accList.length) + '"><cfRule type="cellIs" dxfId="' + dResNeg + '" priority="' + (pr++) + '" operator="lessThan"><formula>0</formula></cfRule><cfRule type="cellIs" dxfId="' + dResPos + '" priority="' + (pr++) + '" operator="greaterThan"><formula>0</formula></cfRule></conditionalFormatting>');
      row = ah + accList.length + 2;
    }

    /* ===== Примечание ===== */
    var notes = ['Как читать отчёт', 'Расходы считаются за вычетом возвратов. Переводы между счетами в доходы и расходы не входят.', 'Итоги, категории, динамика и дни недели посчитаны формулами по листу «Операции»: если поправить данные там, цифры здесь пересчитаются.', 'Все суммы указаны в валюте операций (по умолчанию гривна).'];
    sum.set(row, 2, notes[0], S({ b: 1, sz: 9, color: C.muted, indent: 1 })); sum.merge(row, 2, row, 13);
    for (var q = 1; q < notes.length; q++) { sum.set(row + q, 2, '•  ' + notes[q], S({ sz: 9, color: C.muted, indent: 1 })); sum.merge(row + q, 2, row + q, 13); }
    sum.maxR = Math.max(sum.maxR, row + notes.length);
    sum.drawing = charts.length > 0;
    sum.landscape = false;


    /* ===== Лист «Год к году» (только при периоде «За всё время») ===== */
    var yoy = null, ycharts = [], yAnch = [], years = [];
    if (model.yearly && n) { for (var yy = rows[0].date.getFullYear(); yy <= rows[n - 1].date.getFullYear(); yy++) years.push(yy); }
    if (years.length >= 2) {
      yoy = new Sheet('Год к году'); yoy.tab = C.amber;
      csh = yoy; curCh = { xml: ycharts, anch: yAnch };
      var ny = years.length, YC0 = 4, YT = YC0 + ny, lastCol = YT + 4, lastYearCol = YT - 1;
      secEnd = lastCol;
      yoy.cols.push([1, 1, 2]); yoy.cols.push([2, lastCol, 12.7]); yoy.cols.push([lastCol + 1, lastCol + 1, 2]);
      var toCol = Math.min(lastCol, 12);

      // шапка
      yoy.heights[1] = 8;
      for (var yc = 2; yc <= lastCol; yc++) { yoy.set(2, yc, '', heroS()); yoy.set(3, yc, '', heroS()); yoy.set(4, yc, '', S({ fill: C.gold })); }
      yoy.set(2, 2, 'AURUM  ·  Год к году', heroS({ sz: 20, b: 1, indent: 1, color: C.goldText })); yoy.merge(2, 2, 2, lastCol); yoy.heights[2] = 38;
      yoy.set(3, 2, 'Сравнение календарных лет   ·   ' + model.accountLabel + '   ·   Данные с ' + ddmmyyyy(model.start) + ' по ' + ddmmyyyy(addDays(model.end, -1)), heroS({ sz: 10, color: C.heroMuted, indent: 1 })); yoy.merge(3, 2, 3, lastCol); yoy.heights[3] = 24;
      yoy.merge(4, 2, 4, lastCol); yoy.heights[4] = 4; yoy.heights[5] = 12;

      var yLast = years[ny - 1], yPrev = yLast - 1;
      var lastPartial = model.end < new Date(yLast + 1, 0, 1);
      var lastStart = new Date(yLast, 0, 1), lastEnd = lastPartial ? model.end : new Date(yLast + 1, 0, 1);
      var prevStart = new Date(yPrev, 0, 1), prevEnd = lastPartial ? new Date(yPrev, model.end.getMonth(), model.end.getDate()) : new Date(yLast, 0, 1);
      var lastDay = addDays(model.end, -1);
      var winTag = lastPartial ? ' (до ' + ddmm(lastDay) + ')' : '';
      var firstPartial = model.start > new Date(years[0], 0, 1);

      function yCrit(yCell) { return R('A') + ',">="&DATE(' + yCell + ',1,1),' + R('A') + ',"<"&DATE(' + yCell + '+1,1,1)'; }
      function wCrit(a, b) { return R('A') + ',">=' + serial(a) + '",' + R('A') + ',"<' + serial(b) + '"'; }
      function inWin(r, a, b) { return r.date >= a && r.date < b; }
      function yearOf(r) { return r.date.getFullYear(); }
      function monthsIn(y) { var a = new Date(Math.max(new Date(y, 0, 1), model.start)), b = new Date(Math.min(new Date(y + 1, 0, 1), model.end)); return Math.max(1, Math.round((b - a) / 864e5 / 30.4375 * 10) / 10); }

      /* --- 1. Итоги по годам --- */
      var yr = 6;
      section(yr, 'Итоги по годам');
      var yh = yr + 1;
      head(yh, 2, [{ label: 'Год', span: 2 }, { label: 'Доходы', span: 1, h: 'right' }, { label: 'Расходы', span: 1, h: 'right' }, { label: 'Результат', span: 1, h: 'right' }, { label: 'Норма сбережений', span: 1, h: 'right' }, { label: 'Расход в месяц', span: 1, h: 'right' }, { label: 'Операций', span: 1, h: 'right' }], true);
      var y0r = yh + 1, ylr = y0r + ny - 1, ytr = ylr + 1, incYs = [], expYs = [], totInc = 0, totExp = 0, totOps = 0, totMonths = 0;
      years.forEach(function (y, i) {
        var r = y0r + i, ys = new Date(y, 0, 1), ye = new Date(y + 1, 0, 1);
        var yi = sumIf(function (x) { return x.action === 'Доход' && inWin(x, ys, ye); });
        var ye2 = sumIf(function (x) { return x.action === 'Расход' && inWin(x, ys, ye); }) - sumIf(function (x) { return x.action === 'Возврат' && inWin(x, ys, ye); });
        var yo = cntIf(function (x) { return inWin(x, ys, ye); }), mo = monthsIn(y);
        incYs.push(yi); expYs.push(ye2); totInc += yi; totExp += ye2; totOps += yo; totMonths += mo;
        var yc2 = yCrit('$B' + r);
        cell(r, 2, 2, y, { b: 1, h: 'left' });
        cell(r, 4, 1, yi, { fmt: FMT_NUM, h: 'right', color: C.green }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Доход",' + yc2 + ')');
        cell(r, 5, 1, ye2, { fmt: FMT_NUM, h: 'right', color: C.red }, 'SUMIFS(' + R('C') + ',' + R('B') + ',"Расход",' + yc2 + ')-SUMIFS(' + R('C') + ',' + R('B') + ',"Возврат",' + yc2 + ')');
        cell(r, 6, 1, yi - ye2, { fmt: FMT_NUM, h: 'right', b: 1 }, 'D' + r + '-E' + r);
        cell(r, 7, 1, yi ? (yi - ye2) / yi : 0, { fmt: FMT_PCT, h: 'right', color: C.muted }, 'IF(D' + r + '=0,0,F' + r + '/D' + r + ')');
        cell(r, 8, 1, ye2 / mo, { fmt: FMT_NUM, h: 'right', color: C.muted }, 'E' + r + '/' + mo);
        cell(r, 9, 1, yo, { fmt: FMT_INT, h: 'right', color: C.muted }, 'COUNTIFS(' + yc2 + ')');
      });
      cell(ytr, 2, 2, 'Итого', Object.assign({}, tS));
      cell(ytr, 4, 1, totInc, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(D' + y0r + ':D' + ylr + ')');
      cell(ytr, 5, 1, totExp, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(E' + y0r + ':E' + ylr + ')');
      cell(ytr, 6, 1, totInc - totExp, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(F' + y0r + ':F' + ylr + ')');
      cell(ytr, 7, 1, totInc ? (totInc - totExp) / totInc : 0, Object.assign({ fmt: FMT_PCT, h: 'right' }, tS), 'IF(D' + ytr + '=0,0,F' + ytr + '/D' + ytr + ')');
      cell(ytr, 8, 1, totExp / totMonths, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'E' + ytr + '/' + (Math.round(totMonths * 10) / 10));
      cell(ytr, 9, 1, totOps, Object.assign({ fmt: FMT_INT, h: 'right' }, tS), 'SUM(I' + y0r + ':I' + ylr + ')');
      yoy.cf.push('<conditionalFormatting sqref="F' + y0r + ':F' + ytr + '"><cfRule type="cellIs" dxfId="' + dResNeg + '" priority="' + (pr++) + '" operator="lessThan"><formula>0</formula></cfRule><cfRule type="cellIs" dxfId="' + dResPos + '" priority="' + (pr++) + '" operator="greaterThan"><formula>0</formula></cfRule></conditionalFormatting>');
      var cTop = ytr + 2;
      addChart(barChart({
        title: 'Доходы и расходы по годам', legend: true, gap: 80,
        cat: { f: '\'Год к году\'!$B$' + y0r + ':$B$' + ylr, vals: years.slice(), numeric: true },
        series: [{ name: 'Доходы', nameF: '\'Год к году\'!$D$' + yh, f: '\'Год к году\'!$D$' + y0r + ':$D$' + ylr, vals: incYs, color: C.green }, { name: 'Расходы', nameF: '\'Год к году\'!$E$' + yh, f: '\'Год к году\'!$E$' + y0r + ':$E$' + ylr, vals: expYs, color: 'C9963A' }]
      }), 1, cTop - 1, toCol, cTop - 1 + 16);
      var yNext = cTop + 16 + 1;

      /* --- 2 и 3. Матрицы «категория × год» --- */
      function yoyMatrix(titleText, kind, startRow) {
        var isExp = kind === 'exp';
        function sgn(r) { return isExp ? (r.action === 'Расход' ? 1 : r.action === 'Возврат' ? -1 : 0) : (r.action === 'Доход' ? 1 : 0); }
        var catMap = {};
        rows.forEach(function (r) { var g = sgn(r); if (!g) return; var k = r.cat || 'Без категории'; catMap[k] = catMap[k] || { tot: 0 }; catMap[k].tot += g * r.amt; });
        var list = Object.keys(catMap).sort(function (a, b) { return catMap[b].tot - catMap[a].tot; });
        if (!list.length) return startRow;
        function net(name, a, b) { var t = 0; rows.forEach(function (r) { var g = sgn(r); if (g && (name === null || (r.cat || 'Без категории') === name) && inWin(r, a, b)) t += g * r.amt; }); return t; }
        function fx(catRef, crit) {
          return isExp ? 'SUMIFS(' + R('C') + ',' + R('B') + ',"Расход",' + (catRef ? R('E') + ',' + catRef + ',' : '') + crit + ')-SUMIFS(' + R('C') + ',' + R('B') + ',"Возврат",' + (catRef ? R('E') + ',' + catRef + ',' : '') + crit + ')'
            : 'SUMIFS(' + R('C') + ',' + R('B') + ',"Доход",' + (catRef ? R('E') + ',' + catRef + ',' : '') + crit + ')';
        }
        section(startRow, titleText);
        var h = startRow + 1;
        var cols = [{ label: 'Категория', span: 2 }];
        years.forEach(function (y) { cols.push({ label: y, span: 1, h: 'right' }); });
        cols.push({ label: 'Итого', span: 1, h: 'right' });
        cols.push({ label: yPrev + winTag, span: 1, h: 'right' }); cols.push({ label: yLast + winTag, span: 1, h: 'right' });
        cols.push({ label: 'Изменение, ₴', span: 1, h: 'right' }); cols.push({ label: 'Изменение, %', span: 1, h: 'right' });
        head(h, 2, cols, true);
        var m0 = h + 1, ml = m0 + list.length - 1, mt = ml + 1, PC = YT + 1, LC = YT + 2, DC = YT + 3, PCt = YT + 4;
        var pL = colName(PC), lL = colName(LC), dL = colName(DC);
        list.forEach(function (name, i) {
          var r = m0 + i, sumRow = 0;
          cell(r, 2, 2, name, {});
          years.forEach(function (y, j) {
            var v = net(name, new Date(y, 0, 1), new Date(y + 1, 0, 1)); sumRow += v;
            var L = colName(YC0 + j);
            cell(r, YC0 + j, 1, v, { fmt: FMT_NUM, h: 'right' }, fx('$B' + r, yCrit(L + '$' + h)));
          });
          cell(r, YT, 1, sumRow, { fmt: FMT_NUM, h: 'right', b: 1 }, 'SUM(' + colName(YC0) + r + ':' + colName(lastYearCol) + r + ')');
          var pv = net(name, prevStart, prevEnd), lv = net(name, lastStart, lastEnd);
          cell(r, PC, 1, pv, { fmt: FMT_NUM, h: 'right', color: C.muted }, fx('$B' + r, wCrit(prevStart, prevEnd)));
          cell(r, LC, 1, lv, { fmt: FMT_NUM, h: 'right' }, fx('$B' + r, wCrit(lastStart, lastEnd)));
          cell(r, DC, 1, lv - pv, { fmt: FMT_NUM, h: 'right', b: 1 }, lL + r + '-' + pL + r);
          cell(r, PCt, 1, pv === 0 ? (lv === 0 ? '—' : 'новая') : (lv - pv) / pv, { fmt: FMT_PCT, h: 'right', b: 1 }, 'IF(' + pL + r + '=0,IF(' + lL + r + '=0,"—","новая"),' + dL + r + '/' + pL + r + ')');
        });
        cell(mt, 2, 2, 'Итого', Object.assign({}, tS));
        var allTot = 0;
        years.forEach(function (y, j) {
          var L = colName(YC0 + j), v = net(null, new Date(y, 0, 1), new Date(y + 1, 0, 1)); allTot += v;
          cell(mt, YC0 + j, 1, v, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(' + L + m0 + ':' + L + ml + ')');
        });
        cell(mt, YT, 1, allTot, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(' + colName(YT) + m0 + ':' + colName(YT) + ml + ')');
        var tp = net(null, prevStart, prevEnd), tl = net(null, lastStart, lastEnd);
        cell(mt, PC, 1, tp, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(' + pL + m0 + ':' + pL + ml + ')');
        cell(mt, LC, 1, tl, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), 'SUM(' + lL + m0 + ':' + lL + ml + ')');
        cell(mt, DC, 1, tl - tp, Object.assign({ fmt: FMT_NUM, h: 'right' }, tS), lL + mt + '-' + pL + mt);
        cell(mt, PCt, 1, tp === 0 ? '—' : (tl - tp) / tp, Object.assign({ fmt: FMT_PCT, h: 'right' }, tS), 'IF(' + pL + mt + '=0,"—",' + dL + mt + '/' + pL + mt + ')');
        // тепловая карта по годам и цвета изменений (для расходов рост красный, для доходов зелёный)
        yoy.cf.push('<conditionalFormatting sqref="' + colName(YC0) + m0 + ':' + colName(lastYearCol) + ml + '"><cfRule type="colorScale" priority="' + (pr++) + '"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="FFFFFFFF"/><color rgb="FF' + (isExp ? 'F0D9A6' : 'B5E5CA') + '"/></colorScale></cfRule></conditionalFormatting>');
        var up = isExp ? dResNeg : dResPos, down = isExp ? dResPos : dResNeg;
        [dL, colName(PCt)].forEach(function (L) {
          yoy.cf.push('<conditionalFormatting sqref="' + L + m0 + ':' + L + mt + '"><cfRule type="expression" dxfId="' + up + '" priority="' + (pr++) + '"><formula>AND(ISNUMBER(' + L + m0 + '),' + L + m0 + '&gt;0)</formula></cfRule><cfRule type="expression" dxfId="' + down + '" priority="' + (pr++) + '"><formula>AND(ISNUMBER(' + L + m0 + '),' + L + m0 + '&lt;0)</formula></cfRule></conditionalFormatting>');
        });
        var next = mt + 2;
        if (isExp) {
          var topN = Math.min(8, list.length), topCats = list.slice(0, topN);
          addChart(barChart({
            title: 'Топ-' + topN + ' категорий расходов по годам', legend: true, gap: 60,
            cat: { f: '\'Год к году\'!$B$' + m0 + ':$B$' + (m0 + topN - 1), vals: topCats },
            series: years.map(function (y, j) {
              var L = colName(YC0 + j);
              return { name: String(y), nameF: '\'Год к году\'!$' + L + '$' + h, f: '\'Год к году\'!$' + L + '$' + m0 + ':$' + L + '$' + (m0 + topN - 1), vals: topCats.map(function (nm) { return net(nm, new Date(y, 0, 1), new Date(y + 1, 0, 1)); }), color: PALETTE[j % PALETTE.length] };
            })
          }), 1, next - 1, toCol, next - 1 + 17);
          next = next + 17 + 1;
        }
        return next;
      }
      var yRow = yoyMatrix('Расходы по категориям: год к году', 'exp', yNext);
      yRow = yoyMatrix('Доходы по категориям: год к году', 'inc', yRow);

      /* --- примечание --- */
      var yNotes = ['Как читать лист', 'Сравниваются календарные годы. Расходы считаются за вычетом возвратов, переводы между счетами не учитываются.'];
      if (lastPartial) yNotes.push(yLast + ' год ещё не закончен, поэтому в блоке справа он сравнивается с тем же периодом ' + yPrev + ' года (с 1 января по ' + ddmm(lastDay) + '), а не с полным годом.');
      else yNotes.push('В блоке справа сравниваются два последних полных года: ' + yPrev + ' и ' + yLast + '.');
      if (firstPartial) yNotes.push('Данные начинаются с ' + ddmmyyyy(model.start) + ', поэтому ' + years[0] + ' год неполный: его итоги не стоит сравнивать с полными годами напрямую.');
      yNotes.push('Всё посчитано формулами по листу «Операции». Год в заголовке столбца можно поменять: суммы пересчитаются.');
      yoy.set(yRow, 2, yNotes[0], S({ b: 1, sz: 9, color: C.muted, indent: 1 })); yoy.merge(yRow, 2, yRow, lastCol);
      for (var yq = 1; yq < yNotes.length; yq++) { yoy.set(yRow + yq, 2, '•  ' + yNotes[yq], S({ sz: 9, color: C.muted, indent: 1 })); yoy.merge(yRow + yq, 2, yRow + yq, lastCol); }
      yoy.maxR = Math.max(yoy.maxR, yRow + yNotes.length);
      yoy.drawing = ycharts.length > 0;
      yoy.landscape = true;
      csh = sum; curCh = { xml: charts, anch: drawAnchors }; secEnd = 13;
    }

    /* ===== Упаковка ===== */
    var noCache = !!opts.noCache;
    var sheet1 = sum.xml(sst, noCache, true), sheet2 = ops.xml(sst, noCache, false), sheet3 = yoy ? yoy.xml(sst, noCache, false) : null;
    var nMain = charts.length;
    var hdrXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    var files = [];
    function add(name, str) { files.push({ name: name, data: utf8(str) }); }
    var ct = hdrXml + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      (yoy ? '<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' : '') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
      (charts.length ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
      (ycharts.length ? '<Override PartName="/xl/drawings/drawing2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : '') +
      charts.concat(ycharts).map(function (c, i) { return '<Override PartName="/xl/charts/chart' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>'; }).join('') + '</Types>';
    add('[Content_Types].xml', ct);
    add('_rels/.rels', hdrXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
    add('xl/workbook.xml', hdrXml + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="14000" activeTab="0"/></bookViews><sheets><sheet name="Сводка" sheetId="1" r:id="rId1"/>' + (yoy ? '<sheet name="Год к году" sheetId="3" r:id="rId5"/>' : '') + '<sheet name="Операции" sheetId="2" r:id="rId2"/></sheets>' +
      '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="' + (yoy ? 2 : 1) + '" hidden="1">Операции!$A$1:$L$' + N + '</definedName></definedNames><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    add('xl/_rels/workbook.xml.rels', hdrXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' + (yoy ? '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>' : '') + '</Relationships>');
    add('xl/worksheets/sheet1.xml', sheet1);
    add('xl/worksheets/sheet2.xml', sheet2);
    if (sheet3) add('xl/worksheets/sheet3.xml', sheet3);
    add('xl/styles.xml', sb.xml());
    add('xl/sharedStrings.xml', sst.xml());
    if (charts.length) {
      add('xl/worksheets/_rels/sheet1.xml.rels', hdrXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
      add('xl/drawings/drawing1.xml', hdrXml + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        drawAnchors.map(function (a, i) { return anchorXml(i + 1, a[0], a[1], a[2], a[3]); }).join('') + '</xdr:wsDr>');
      add('xl/drawings/_rels/drawing1.xml.rels', hdrXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + charts.map(function (c, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + (i + 1) + '.xml"/>'; }).join('') + '</Relationships>');
      charts.forEach(function (c, i) { add('xl/charts/chart' + (i + 1) + '.xml', c); });
    }
    if (ycharts.length) {
      add('xl/worksheets/_rels/sheet3.xml.rels', hdrXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing2.xml"/></Relationships>');
      add('xl/drawings/drawing2.xml', hdrXml + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        yAnch.map(function (a, i) { return anchorXml(i + 1, a[0], a[1], a[2], a[3]); }).join('') + '</xdr:wsDr>');
      add('xl/drawings/_rels/drawing2.xml.rels', hdrXml + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + ycharts.map(function (c, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart' + (nMain + i + 1) + '.xml"/>'; }).join('') + '</Relationships>');
      ycharts.forEach(function (c, i) { add('xl/charts/chart' + (nMain + i + 1) + '.xml', c); });
    }
    return zip(files);
  }


export { buildReportXlsx };
