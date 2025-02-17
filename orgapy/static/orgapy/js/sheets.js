const DEFAULT_COLUMN_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 32;
const SHRUNK_ROW_HEIGHT = 24;
const MINIMUM_ROW_HEIGHT = DEFAULT_ROW_HEIGHT;
const MINIMUM_COLUMN_WIDTH = MINIMUM_ROW_HEIGHT;
const FIRST_COLUMN_WIDTH = 42;
const HANDLE_SIZE = 5;

const CTYPE_TEXT = 0;
const CTYPE_BOOLEAN = 1;
const CTYPE_INTEGER = 2;
const CTYPE_FLOAT = 3;
const CTYPE_SCIENTIFIC = 4; 
const CTYPE_PERCENTAGE = 5;
const CTYPE_MONETARY = 6;
const CTYPE_DATETIME = 7;
const CTYPE_DATE = 8;
const CTYPE_TIME = 9;
const CTYPE_DURATION = 10;

const HIGHLIGHT_ACCENT = 0;
const HIGHLIGHT_SUCCESS = 1;
const HIGHLIGHT_ERROR = 2;


const SCRIPT_FUNCTION_PATTERN = /^(Round|Floor|Ceil|Sum|Mean|Count|Min|Max)\(/gi;
const SCRIPT_OPERATOR_PATTERN = /^(\+|\*\*|\-|\*|\/|%)/gi;
const SCRIPT_CONSTANT_PATTERN = /^("[^"]+"|\d+(\.\d+)?|\.?\d+)/g;
const SCRIPT_LOCATION_PATTERN = /^[^,]+,(i|\*|\d+:\d+|\d+)/gi;

const OPERATOR_ADD = 0;
const OPERATOR_SUB = 1;
const OPERATOR_MUL = 2;
const OPERATOR_DIV = 3;
const OPERATOR_MOD = 4;
const OPERATOR_POW = 5;

const FUNCTION_ROUND = 0;
const FUNCTION_FLOOR = 1;
const FUNCTION_CEIL = 2;
const FUNCTION_SUM = 3;
const FUNCTION_MEAN = 4;
const FUNCTION_COUNT = 5;
const FUNCTION_MIN = 6;
const FUNCTION_MAX = 7;


function findClosingParenthesis(string, start=0) {
    if (string.charAt(start) != "(") throw new Error("First char should be '('");
    let level = 0;
    for (let i = start; i < string.length; i++) {
        let char = string.charAt(i);
        if (char == "(") level++;
        if (char == ")") level--;
        if (level == 0) return i;
    }
    return null;
}


class AxisLocation {

    constructor() {}

    static fromString(string) {
        let clean = string.trim();
        if (clean == "*") return new AxisLocationRange();
        if (clean.includes(":")) {
            let split = clean.split(":", 2);
            let start = null;
            let end = null;
            if (split[0].trim() != "") start = split[0].trim();
            if (split[1].trim() != "") end = split[1].trim();
            return new AxisLocationRange(start, end);
        }
        const RELATIVE_LOCATION_PATTERN = /^[ij]([\+\-]\d+)?$/;
        if (string.match(RELATIVE_LOCATION_PATTERN)) {
            let match = RELATIVE_LOCATION_PATTERN.exec(string);
            let offset = 0;
            if (match[1] != null) offset = parseInt(match[1]);
            return new AxisLocationRelative(offset);
        }
        return new AxisLocationAbsolute(string);
    }

    evaluate(k, min, max, indexOf) {
        throw new Error("Not implemented!");
    }

    indices(k, min, max, indexOf) {
        throw new Error("Not implemented!");
    }

}


class AxisLocationAbsolute extends AxisLocation {

    constructor(position) {
        super();
        this.position = position;
    }

    toString() {
        return `<Absolute ${this.position}>`;
    }

    evaluate(k, min, max, indexOf) {
        let l = indexOf(this.position);
        if (l < min || l > max) throw new Error(`Index out of bounds: ${l} (original position: ${this.position})`);
        return l;
    }

    indices(k, min, max, indexOf) {
        return [this.evaluate(k, min, max, indexOf)];
    }

}


class AxisLocationRelative extends AxisLocation {

    constructor(offset=0) {
        super();
        this.offset = offset;
    }

    toString() {
        return `<Relative ${this.offset > 0 ? "+" : ""}${this.offset}>`;
    }

    evaluate(k, min, max, indexOf) {
        let l = k + this.offset;
        if (l < min || l > max) throw new Error(`Index out of bounds: ${l}`);
        return l;
    }

    indices(k, min, max, indexOf) {
        return [this.evaluate(k, min, max, indexOf)];
    }

}


class AxisLocationRange extends AxisLocation {

    constructor(start=null, end=null) {
        super();
        this.start = start;
        this.end = end;
    }

    toString() {
        if (this.start == null && this.end == null) {
            return "<Range *>";
        } else if (this.end == null) {
            return `<Range ${this.start}:>`;
        } else if (this.start == null) {
            return `<Range :${this.end}>`;
        } else {
            return `<Range ${this.start}:${this.end}>`;
        }
    }

    evaluate(k, min, max, indexOf) {
        throw new Error("Can not evaluate range axis location");
    }

    indices(k, min, max, indexOf) {
        let lMin = min;
        if (this.start != null) lMin = Math.max(lMin, indexOf(this.start));
        let lMax = max;
        if (this.end != null) lMax = Math.min(lMax, indexOf(this.end));
        let indices = [];
        for (let l = lMin; l <= lMax; l++) {
            indices.push(l);
        }
        return indices;
    }

}


class CellLocation {

    constructor(rowLocation, columnLocation) {
        this.row = rowLocation;
        this.column = columnLocation;
    }

    static fromString(string) {
        let split = string.split(",");
        return new CellLocation(
            AxisLocation.fromString(split[1]),
            AxisLocation.fromString(split[0]));
    }

    toString() {
        return `<${this.row.toString()}, ${this.column.toString()}>`;
    }

    evaluate(sheet, i, j) {
        return {
            i: this.row.evaluate(i, 0, sheet.height - 1, s => sheet.indexOfRows(s)),
            j: this.column.evaluate(j, 0, sheet.width - 1, s => sheet.indexOfColumns(s))
        };
    }

    indices(sheet, i, j) {
        let rowIndices = this.row.indices(i, 0, sheet.height - 1, s => sheet.indexOfRows(s));
        let columnIndices = this.column.indices(j, 0, sheet.width - 1, s => sheet.indexOfColumns(s));
        let indices = { idx: [] };
        rowIndices.forEach(p => {
            columnIndices.forEach(q => {
                indices.idx.push([p, q]);
            });
        });
        indices.forEach = (callback) => {
            for (let p = 0; p < indices.idx.length; p++) {
                callback(indices.idx[p][0], indices.idx[p][1]);
            }
        }
        return indices;
    }

}


class Expression {

    constructor() {}

    static fromString(string) {
        let clean = string.trim();
        if (clean == "") return null;
        let left = null;
        let operator = null;
        let right = null;
        let tail = null;
        let constant = null;
        if (clean.charAt(0) == "(") {
            let i = findClosingParenthesis(clean);
            left = Expression.fromString(clean.substring(1, i).trim());
            tail = clean.substring(i + 1).trim();
        } else if (clean.match(SCRIPT_FUNCTION_PATTERN)) {
            let match = clean.match(SCRIPT_FUNCTION_PATTERN)[0];
            let i = findClosingParenthesis(clean, match.length - 1);
            let innerString = clean.substring(match.length, i).trim();
            let fun = null;
            switch (match.substring(0, match.length - 1)) {
                case "Round":
                    fun = FUNCTION_ROUND;
                    break;
                case "Floor":
                    fun = FUNCTION_FLOOR;
                    break;
                case "Ceil":
                    fun = FUNCTION_CEIL;
                    break;
                case "Sum":
                    fun = FUNCTION_SUM;
                    break;
                case "Mean":
                    fun = FUNCTION_MEAN;
                    break;
                case "Count":
                    fun = FUNCTION_COUNT;
                    break;
                case "Min":
                    fun = FUNCTION_MIN;
                    break;
                case "Max":
                    fun = FUNCTION_MAX;
                    break;
            }
            if (fun == FUNCTION_ROUND || fun == FUNCTION_FLOOR || fun == FUNCTION_CEIL) {
                left = new ExpressionBaseFunction(fun, Expression.fromString(innerString));
            } else {
                left = new ExpressionRangeFunction(fun, CellLocation.fromString(innerString));
            }
            tail = clean.substring(i + 1).trim();
        } else if (clean.match(SCRIPT_CONSTANT_PATTERN)) {
            constant = clean.match(SCRIPT_CONSTANT_PATTERN)[0];
            if (constant.startsWith("\"")) {
                left = new ExpressionConstant(constant.substring(1, constant.length - 1));
            } else {
                left = new ExpressionConstant(parseFloat(constant));
            }
            tail = clean.substring(constant.length).trim();
        } else if (clean.match(SCRIPT_LOCATION_PATTERN)) {
            let match = clean.match(SCRIPT_LOCATION_PATTERN)[0];
            left = new ExpressionCell(CellLocation.fromString(match));
            tail = clean.substring(match.length).trim();
        } else {
            throw new Error("Could not parse expression:", clean);
        }
        if (tail != null && tail != "") {
            let operatorMatch = tail.match(SCRIPT_OPERATOR_PATTERN)[0];
            switch (operatorMatch) {
                case "+":
                    operator = OPERATOR_ADD;
                    break;
                case "-":
                    operator = OPERATOR_SUB;
                    break;
                case "*":
                    operator = OPERATOR_MUL;
                    break;
                case "/":
                    operator = OPERATOR_DIV;
                    break;
                case "%":
                    operator = OPERATOR_MOD;
                    break;
                case "**":
                    operator = OPERATOR_POW;
                    break;
            }
            right = Expression.fromString(tail.substring(operatorMatch.length));
            return new ExpressionTernary(left, operator, right);
        } else {
            return left;
        }
    }

    evaluate(sheet, i, j) {
        throw new Error("Not implemented!");
    }

}


class ExpressionConstant extends Expression {

    constructor(value) {
        super();
        this.value = value;
    }

    toString() {
        return `<Constant: ${this.value}>`;
    }

    evaluate(sheet, i, j) {
        return this.value;
    }
    
}


class ExpressionCell extends Expression {

    constructor(cellLocation) {
        super();
        this.cellLocation = cellLocation;
    }

    toString() {
        return `<CellLocation: ${this.cellLocation.toString()}>`;
    }

    evaluate(sheet, i, j) {
        let position = this.cellLocation.evaluate(sheet, i, j);
        return sheet.values[position.i][position.j];
    }

}


class ExpressionBaseFunction extends Expression {

    constructor(fun, argument) {
        super();
        this.fun = fun;
        this.argument = argument;
    }

    toString() {
        return `<Function ${this.fun} of ${this.argument.toString()}>`;
    }

    evaluate(sheet, i, j) {
        let a = this.argument.evaluate(sheet, i, j);
        if (a == null) return null;
        switch(this.fun) {
            case FUNCTION_ROUND:
                return Math.round(a);
            case FUNCTION_FLOOR:
                return Math.floor(a);
            case FUNCTION_CEIL:
                return Math.ceil(a);
        }
    }

}


class ExpressionRangeFunction extends Expression {
    
    constructor(fun, cellLocation) {
        super();
        this.fun = fun;
        this.cellLocation = cellLocation;
    }

    toString() {
        return `<Function ${this.fun} of range ${this.cellLocation.toString()}>`;
    }

    evaluateSum(sheet, indices) {
        let r = 0;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null) r += sheet.values[i][j];
        });
        return r;
    }

    evaluateMean(sheet, indices) {
        let r = 0;
        let s = 0;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null) {
                r += sheet.values[i][j];
                s++;
            }
        });
        return r / s;
    }

    evaluateCount(sheet, indices) {
        let r = 0;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null) r++;
        });
        return r;
    }

    evaluateMin(sheet, indices) {
        let r = null;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null && (r == null || sheet.values[i][j] < r)) r = sheet.values[i][j];
        });
        return r;
    }

    evaluateMax(sheet, indices) {
        let r = null;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null && (r == null || sheet.values[i][j] > r)) r = sheet.values[i][j];
        });
        return r;
    }

    evaluate(sheet, i, j) {
        let indices = this.cellLocation.indices(sheet, i, j);
        switch(this.fun) {
            case FUNCTION_SUM:
                return this.evaluateSum(sheet, indices);
            case FUNCTION_MEAN:
                return this.evaluateMean(sheet, indices);
            case FUNCTION_COUNT:
                return this.evaluateCount(sheet, indices);
            case FUNCTION_MIN:
                return this.evaluateMin(sheet, indices);
            case FUNCTION_MAX:
                return this.evaluateMax(sheet, indices);
        }
    }

}


class ExpressionTernary extends Expression {

    constructor(left, operator, right) {
        super();
        this.left = left;
        this.operator = operator;
        this.right = right;
    }

    toString() {
        return `<Ternary Op ${this.operator} of ${this.left.toString()} and ${this.right.toString()}>`;
    }

    evaluate(sheet, i, j) {
        let a = this.left.evaluate(sheet, i, j);
        let b = this.right.evaluate(sheet, i, j);
        if (a == null || b == null) return null;
        switch (this.operator) {
            case OPERATOR_ADD:
                return a + b;
            case OPERATOR_SUB:
                return a - b;
            case OPERATOR_MUL:
                return a * b;
            case OPERATOR_DIV:
                return a / b;
            case OPERATOR_MOD:
                return a % b;
            case OPERATOR_POW:
                return Math.pow(a, b);
        }
    }

}


class Script {

    constructor(formulas, string) {
        this.formulas = formulas;
        this.string = string;
    }

    static fromString(string) {
        let formulas = [];
        string.split("\n").forEach((line, i) => {
            if (line.trim() != "" && line.charAt(0) != "#") {
                //console.log(line);
                try {
                    let split = line.split("=");
                    if (split.length != 2) throw new Error("Syntax error: Could not parse formula");
                    let formula = {
                        location: CellLocation.fromString(split[0]),
                        expression: Expression.fromString(split[1])
                    };
                    formulas.push(formula);
                    //console.log(formula.location.toString(), formula.expression.toString());
                } catch (error) {
                    console.error(`Could not parse formula at line ${i}:`, error);
                }          
            }
        });
        return new Script(formulas, string);
    }

    evaluate(sheet) {
        this.formulas.forEach(formula => {
            try {
                formula.location.indices(sheet, 0, 0).forEach((i, j) => {
                    sheet.values[i][j] = formula.expression.evaluate(sheet, i, j);
                    sheet.setCellContent(i, j);
                });
            } catch (error) {
                console.error("Encountered an error while evaluating", formula, ":", error);
            }
        });     
        sheet.updateFilters();
    }

}


function tidy(array, order) {
    let buffer = [];
    order.forEach(i => {
        buffer.push(array[i]);
    });
    return buffer;
}


function rowname(i) {
    return `${i + 1}`;
}


function colname(i) {
    let p = 1;
    let lb = 0;
    let ub = 25;
    while (true) {
        if (i <= ub) break;
        p++;
        lb = ub + 1;
        ub = ub + Math.pow(26, p);
    }
    let string = (i - lb).toString(26);
    let codes = [];
    for (let k = 0; k < string.length; k++) {
        let inCode = string.charCodeAt(k);
        let digit = inCode <= 57 ? inCode - 48 : inCode - 87;
        let outCode = digit + 65;
        codes.push(outCode);
    }
    for (let k = codes.length; k < p; k++) {
        codes.splice(0, 0, 65);
    }
    return String.fromCharCode(...codes);
}

const MARKDOWN_PATTERN_BOLD = /\*\*([^\*]+)\*\*/;
const MARKDOWN_PATTERN_ITALIC = /\*([^\*]+)\*/;
const MARKDOWN_PATTERN_STRIKE = /~~([^~]+)~~/;
const MARKDOWN_PATTERN_CODE = /`([^`]+)`/;
const MARKDOWN_PATTERN_LINK = /\[([^\[\]]*)\]\(([^\(\)]*)\)/;
const MARKDOWN_PATTERN_URL = /((?:https?:\/\/)?(?:[-a-zA-Z0-9éèàç@:%._\+~#=]{2,256}\.(?:[a-z]{2,10})|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b(?:[-a-zA-Z0-9éèàç@:%_\+.~#?&//=]*))/


function convertMarkdownToHtml(string) {
    string = string.replace(MARKDOWN_PATTERN_BOLD, "<b>$1</b>");
    string = string.replace(MARKDOWN_PATTERN_ITALIC, "<i>$1</i>");
    string = string.replace(MARKDOWN_PATTERN_STRIKE, "<s>$1</s>");
    string = string.replace(MARKDOWN_PATTERN_CODE, "<code>$1</code>");
    if (string.match(MARKDOWN_PATTERN_LINK)) {
        string = string.replace(MARKDOWN_PATTERN_LINK, `<a href="$2">$1</a>`);
    } else {
        string = string.replace(MARKDOWN_PATTERN_URL, `<a href="$1">$1</a>`);
    }
    return string.replaceAll("\n", "<br>")
}


function safeFormat(value, formatter) {
    if (value == null) return "";
    try {
        return formatter(value);
    } catch {
        return `${value}`;
    }
}


function safeParse(string, parser) {
    if (string == null) string = "";
    if (typeof(string) != typeof("")) string = `${string}`;
    let trimmed = string.trim();
    if (trimmed == "") return null;
    try {
        return parser(trimmed);
    } catch {
        return trimmed;
    }
}


function parseTsv(string) {
    string = string.replaceAll("\r", "");
    let array = [[]];
    let buffer = "";
    let i = 0;
    let isNextRow = false;
    let isEscapedString = false;
    while (i < string.length) {
        buffer = "";
        isNextRow = false;
        isEscapedString = false;
        let first_char = string.charAt(i);
        isEscapedString = first_char == "\"";
        if (isEscapedString) i++;
        while (i < string.length) {
            let char = string.charAt(i);
            if (char == "\t" && !isEscapedString) {
                i++;
                break;
            }
            if (char == "\n" && !isEscapedString) {
                isNextRow = true;
                i++;
                break;
            }
            if (char == "\\" && isEscapedString) {
                console.log("double slash here!");
                i++;
                if (i < string.length) {
                    let nextChar = string.charAt(i);
                    console.log("next char is", nextChar);
                    if (nextChar == "\"") {
                        buffer += nextChar;
                        i++;
                        continue;
                    }
                }
                i--;
            }
            if (char == "\"" && isEscapedString) {
                i++;
                if (i < string.length) {
                    let nextChar = string.charAt(i);
                    if (nextChar == "\n") {
                        isNextRow = true;
                    }
                    i++;
                }
                break;
            }
            buffer += char;
            i++;
        }
        array[array.length - 1].push(buffer);
        if (isNextRow) array.push([]);
    }
    return array;
}


function escapeTsvValue(value) {
    if (value.includes("\n") || value.includes("\t")) {
        return `"${value.replaceAll("\"", "\\\"")}"`;
    }
    return value;
}


function formatTsv(array) {
    let rows = [];
    array.forEach(row => {
        rows.push(row.map(escapeTsvValue).join("\t"));
    });
    return rows.join("\n");
}


class SelectionRange {

    constructor(sheet, startI, startJ, endI=null, endJ=null) {
        this.sheet = sheet;
        this.startI = startI;
        this.startJ = startJ;
        this.endI = endI == null ? this.startI : endI;
        this.endJ = endJ == null ? this.startJ : endJ;
        this.top = null;
        this.bottom = null;
        this.left = null;
        this.right = null;
        this.updateBounds();
    }

    updateBounds() {
        this.top = Math.min(this.startI, this.endI);
        this.bottom = Math.max(this.startI, this.endI);
        this.left = Math.min(this.startJ, this.endJ);
        this.right = Math.max(this.startJ, this.endJ);
    }

    iterate(innerCallback, outerCallback=null) {
        for (let i = this.top; i <= this.bottom; i++) {
            let top = i == this.top;
            let bottom = i == this.bottom;
            if (outerCallback != null) outerCallback(i, top, bottom);
            for (let j = this.left; j <= this.right; j++) {
                let left = j == this.left;
                let right = j == this.right;
                innerCallback(i, j, top, left, bottom, right);
            }
        }
    }

    containsRow(i) {
        return i >= this.top && i <= this.bottom;
    }

    containsColumn(j) {
        return j >= this.left && j <= this.right;
    }

    contains(i, j) {
        return this.containsRow(i) && this.containsColumn(j);
    }

    update(i, j) {
        this.endI = i;
        this.endJ = j;
        this.updateBounds();
    }
    
    actualDi(di) {
        let actualDi = 0;
        let visibleDi = 0;
        if (di >= 0) {
            while (visibleDi < di && this.bottom + actualDi < this.sheet.height) {
                actualDi++;
                if (this.sheet.filteredRows.has(this.bottom + actualDi)) visibleDi++;
            }
        } else {
            while (visibleDi > di && this.top + actualDi >= 0) {
                actualDi--;
                if (this.sheet.filteredRows.has(this.top + actualDi)) visibleDi--;
            }
        }
        return actualDi;
    }

    move(di, dj, keepShape) {
        di = this.actualDi(di);
        this.startI = Math.max(0, Math.min(this.sheet.height-1, this.startI + di));
        this.startJ = Math.max(0, Math.min(this.sheet.width-1, this.startJ + dj));
        if (keepShape) {
            this.endI = Math.max(0, Math.min(this.sheet.height-1, this.endI + di));
            this.endJ = Math.max(0, Math.min(this.sheet.width-1, this.endJ + dj));
        } else {
            this.endI = this.startI;
            this.endJ = this.startJ;
        }
        this.updateBounds();
    }

    expand(di, dj) {
        di = this.actualDi(di);
        this.endI = Math.max(0, Math.min(this.sheet.height-1, this.endI + di));
        this.endJ = Math.max(0, Math.min(this.sheet.width-1, this.endJ + dj));
        this.updateBounds();
    }

}


class Selection {

    constructor(sheet) {
        this.sheet = sheet;
        this.ranges = [];
        this.filteredRanges = [];
    }

    root() {
        if (this.ranges.length == 0) return {i: 0, j: 0};
        return {i: this.ranges[0].startI, j: this.ranges[0].startJ};
    }

    clear() {
        this.sheet.container.querySelectorAll(".selected").forEach(element => {
            element.classList.remove("selected");
            element.classList.remove("selected-top");
            element.classList.remove("selected-left");
            element.classList.remove("selected-bottom");
            element.classList.remove("selected-right");
        });
    }

    reset() {
        for (let k = this.ranges.length - 1; k >= 0; k--) {
            delete this.ranges[k];
            this.ranges.splice(k, 1);
        }
        for (let k = this.filteredRanges.length - 1; k >= 0; k--) {
            delete this.filteredRanges[k];
            this.filteredRanges.splice(k, 1);
        }
    }

    set() {
        this.clear();
        let selectedRows = new Set();
        let selectedColumns = new Set();
        this.filteredRanges.forEach(range => {
            range.iterate((i, j, top, left, bottom, right) => {
                selectedRows.add(i);
                selectedColumns.add(j);
                this.sheet.cells[i][j].classList.add("selected");
                if (top) this.sheet.cells[i][j].classList.add("selected-top");
                if (left) this.sheet.cells[i][j].classList.add("selected-left");
                if (bottom) this.sheet.cells[i][j].classList.add("selected-bottom");
                if (right) this.sheet.cells[i][j].classList.add("selected-right");
            });
        });
        selectedRows.forEach(i => {
            this.sheet.rowHeads[i].classList.add("selected");
        });
        selectedColumns.forEach(j => {
            this.sheet.columnHeads[j].classList.add("selected");
        });
    }

    containsRow(i) {
        for (let k = 0; k < this.ranges.length; k++) {
            if (this.ranges[k].containsRow(i)) return true;
        }
        return false;
    }

    containsColumn(j) {
        for (let k = 0; k < this.ranges.length; k++) {
            if (this.ranges[k].containsColumn(j)) return true;
        }
        return false;
    }

    contains(i, j) {
        for (let k = 0; k < this.ranges.length; k++) {
            if (this.ranges[k].contains(i, j)) return true;
        }
        return false;
    }

    start(i, j, selectingRows, selectingColumns) {
        this.reset();
        this.add(i, j, selectingRows, selectingColumns);
    }

    add(i, j, selectingRows, selectingColumns) {
        let endI = selectingColumns ? this.sheet.height - 1 : null;
        let endJ = selectingRows ? this.sheet.width - 1 : null;
        this.ranges.push(new SelectionRange(this.sheet, i, j, endI, endJ));
        this.setFilteredRanges();
    }

    update(i, j) {
        if (this.ranges.length == 0) return;
        this.ranges[this.ranges.length - 1].update(i, j);
        this.setFilteredRanges();
        this.set();
    }

    all() {
        this.reset();
        this.ranges.push(new SelectionRange(this.sheet, 0, 0, this.sheet.height - 1, this.sheet.width - 1));
        this.setFilteredRanges();
        this.set();
    }

    iterate(callback) {
        this.filteredRanges.forEach(range => {
            range.iterate(callback);
        });
    }

    move(di, dj, keepShape=false) {
        this.ranges.forEach(range => {
            range.move(di, dj, keepShape);
        });
        // TODO: merge ranges!
        this.setFilteredRanges();
        this.set();
        this.checkSheetScroll(di < 0);
    }

    expand(di, dj) {
        this.ranges.forEach(range => {
            range.expand(di, dj);
        });
        // TODO: merge ranges!
        this.setFilteredRanges();
        this.set();
        this.checkSheetScroll(di < 0);
    }

    checkSheetScroll(moveUp=false) {
        let root = this.root();
        let i = root.i;
        if (moveUp && i > 0) i--;
        let cell = this.sheet.cells[i][root.j];
        cell.scrollIntoView({
            behavior: "auto",
            block: "nearest",
            inline: "nearest",
        });
        if (moveUp && root.i == 0) {
            this.sheet.table.parentNode.scrollTo(this.sheet.table.parentNode.scrollLeft, 0); /* TODO: fixed this */
        }
    }

    bounds() {
        let b = {
            top: null,
            left: null,
            bottom: null,
            right: null
        }
        this.ranges.forEach(range => {
            if (b.top == null || range.top < b.top) b.top = range.top;
            if (b.left == null || range.left < b.left) b.left = range.left;
            if (b.bottom == null || range.bottom > b.bottom) b.bottom = range.bottom;
            if (b.right == null || range.right > b.right) b.right = range.right;
        });
        return b;
    }

    setFilteredRanges() {
        this.filteredRanges = [];
        this.ranges.forEach(range => {
            this.filteredRanges.push(new SelectionRange(this.sheet, range.startI, range.startJ, range.endI, range.endJ));
        });
        for (let i = 0; i < this.sheet.height; i++) {
            if (this.sheet.filteredRows.has(i)) continue;
            let changed = true;
            while (changed) {
                changed = false;
                for (let k = 0; k < this.filteredRanges.length; k++) {
                    if (!this.filteredRanges[k].containsRow(i)) continue;
                    if (i > this.filteredRanges[k].top) {
                        this.filteredRanges.push(new SelectionRange(
                            this.sheet,
                            this.filteredRanges[k].top,
                            this.filteredRanges[k].startJ,
                            i - 1,
                            this.filteredRanges[k].endJ
                        ));
                    }
                    if (i < this.filteredRanges[k].bottom) {
                        this.filteredRanges.push(new SelectionRange(
                            this.sheet,
                            i + 1,
                            this.filteredRanges[k].startJ,
                            this.filteredRanges[k].bottom,
                            this.filteredRanges[k].endJ
                        ));
                    }
                    delete this.filteredRanges[k];
                    this.filteredRanges.splice(k, 1);
                    changed = true;
                    break;
                }
            }
        }
    }

    rows() {
        let set = new Set();
        this.iterate((i, j) => {
            set.add(i);
        });
        let array = Array.from(set);
        array.sort();
        return array;
    }

    columns() {
        let set = new Set();
        this.iterate((i, j) => {
            set.add(j);
        });
        let array = Array.from(set);
        array.sort();
        return array;
    }

}


class ColumnType {

    static ID = null;
    static ALIGNEMENT = "aleft";
    static LABEL = null;

    constructor() {}

    formatHtml(value) {
        return this.formatText(value);
    }

    formatText(value) {
        return safeFormat(value, x => x);
    }

    parse(string) {
        return safeParse(string, x => x);
    }

}


class ColumnTypeText extends ColumnType {

    static ID = CTYPE_TEXT;
    static ALIGNEMENT = "aleft";
    static LABEL = "Text";

    formatHtml(value) {
        return safeFormat(value, convertMarkdownToHtml);
    }

}


class ColumnTypeBoolean extends ColumnType {

    static ID = CTYPE_BOOLEAN;
    static ALIGNEMENT = "acenter";
    static LABEL = "Boolean";

    formatHtml(value) {
        return safeFormat(value, x => x != "false" && x != "0" && x != "no" ? "✔️": "❌");
    }

}


class ColumnTypeInteger extends ColumnType {

    static ID = CTYPE_INTEGER;
    static ALIGNEMENT = "aright";
    static LABEL = "Integer";

    formatText(value) {
        return safeFormat(value, x => x.toString());
    }

    parse(string) {
        return safeParse(string, x => {
            let parsed = parseInt(x);
            if (isNaN(parsed)) throw new Error("NaN");
            return parsed;
        });
    }

}


class ColumnTypeFloat extends ColumnType {

    static ID = CTYPE_FLOAT;
    static ALIGNEMENT = "aright";
    static LABEL = "Float";

    formatText(value) {
        return safeFormat(value, x => x.toString());
    }

    parse(string) {
        return safeParse(string, x => {
            let parsed = parseFloat(x);
            if (isNaN(parsed)) throw new Error("NaN");
            return parsed;
        });
    }

}


class ColumnTypeScientific extends ColumnTypeFloat {

    static ID = CTYPE_SCIENTIFIC;
    static ALIGNEMENT = "aright";
    static LABEL = "Scientific";

    formatHtml(value) {
        return safeFormat(value, x => x.toExponential(3));
    }

}


class ColumnTypePercentage extends ColumnTypeFloat {

    static ID = CTYPE_PERCENTAGE;
    static ALIGNEMENT = "aright";
    static LABEL = "Percentage";

    formatHtml(value) {
        return safeFormat(value, x => (x * 100).toFixed(2) + " %");
    }

}


class ColumnTypeMonetary extends ColumnTypeFloat {

    static ID = CTYPE_MONETARY;
    static ALIGNEMENT = "aright";
    static LABEL = "Monetary";

    formatHtml(value) {
        return safeFormat(value, x => x.toFixed(2) + " €");
    }

}


class ColumnTypeDatetime extends ColumnType {

    static ID = CTYPE_DATETIME;
    static ALIGNEMENT = "aleft";
    static LABEL = "Datetime";

    formatText(value) {
        return safeFormat(value, x => x.toLocaleString());
    }

    parse(string) {
        return safeParse(string, x => {
            let timestamp = Date.parse(x);
            if (isNaN(timestamp)) throw new Error("Could not parse datetime");
            new Date(timestamp);
        });
    }

}


class ColumnTypeDate extends ColumnType {

    static ID = CTYPE_DATE;
    static ALIGNEMENT = "aleft";
    static LABEL = "Date";

    formatText(value) {
        return safeFormat(value, x => {
            return `${x.getFullYear()}-${(x.getMonth() + 1).toString().padStart(2, "0")}-${x.getDate().toString().padStart(2, "0")}`;
        });
    }

    parse(string) {
        return safeParse(string, x => {
            const pattern = /(\d+)[/-](\d+)(?:[/-](\d+))?/g;
            const match = pattern.exec(x);
            if (match == null) throw new Error("Could not parse date");
            let day = null;
            let month = null;
            let year = (new Date()).getFullYear();
            if (match[3] != null) {
                if (match[1].length == 4) {
                    day = parseInt(match[3]);
                    month = parseInt(match[2]);
                    year = parseInt(match[1]);
                } else {
                    day = parseInt(match[1]);
                    month = parseInt(match[2]);
                    if (match[3].length == 4) {
                        year = parseInt(match[3]);
                    } else {
                        year = 2000 + parseInt(match[3]);
                    }
                }
            } else {
                day = parseInt(match[1]);
                month = parseInt(match[2]);
            }
            month--;
            let date = new Date();
            date.setHours(0, 0, 0, 0);
            date.setFullYear(year, month, day);
            return date;
        });
    }

}


class ColumnTypeTime extends ColumnType {

    static ID = CTYPE_TIME;
    static ALIGNEMENT = "aleft";
    static LABEL = "Time";

    formatText(value) {
        return safeFormat(value, x => {
            return `${x.getHours().toString().padStart(2, "0")}:${x.getMinutes().toString().padStart(2, "0")}:${x.getSeconds().toString().padStart(2, "0")}`
        });
    }

    parse(string) {
        return safeParse(string, x => {
            const pattern = /(\d+)[h:](\d+)(?::(\d+))?/g;
            const match = pattern.exec(x);
            if (match == null) throw new Error("Could not parse time");
            let hours = parseInt(match[1]);
            let minutes = parseInt(match[2]);
            let seconds = 0;
            if (match[3] != null) {
                seconds = parseInt(match[3]); 
            }
            let date = new Date();
            date.setFullYear(1970, 1, 1);
            date.setHours(hours, minutes, seconds, 0);
            return date;
        });
    }

}


class ColumnTypeDuration extends ColumnType {

    static ID = CTYPE_DURATION;
    static ALIGNEMENT = "aright";
    static LABEL = "Duration";

    formatText(value) {
        return safeFormat(value, x => {
            let hours = Math.floor(x / 3600);
            let minutes = Math.floor((x - 3600 * hours) / 60);
            let seconds = Math.floor(x - 3600 * hours - 60 * minutes);
            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
            }
            return `${minutes}:${seconds.toString().padStart(2, "0")}`;
        });
    }

    parse(string) {
        return safeParse(string, x => {
            const pattern = /(\d+)[h:](\d+)(?::(\d+))?/g;
            const match = pattern.exec(x);
            if (match == null) throw new Error("Could not parse duration");
            if (match[3] == null) {
                return 60 * parseInt(match[1]) + parseInt(match[2]);
            }
            return 3600 * parseInt(match[1]) + 60 * parseInt(match[2]) + parseInt(match[3]);
        });
    }

}


const COLUMN_TYPES = [
    ColumnTypeText,
    ColumnTypeBoolean,
    ColumnTypeInteger,
    ColumnTypeFloat,
    ColumnTypeScientific,
    ColumnTypePercentage,
    ColumnTypeMonetary,
    ColumnTypeDatetime,
    ColumnTypeDate,
    ColumnTypeTime,
    ColumnTypeDuration,
];


class ContextMenu {

    constructor() {
        this.container = null;
    }

    setup() {
        this.container = create(document.body, "div", "context-menu");
        var self = this;
        window.addEventListener("click", () => {
            self.close();
        });
    }

    reset() {
        this.container.innerHTML = "";
        this.container.classList.remove("active");
    }

    addItem(label, callback) {
        let element = create(this.container, "div", "context-menu-item");
        element.innerHTML = label;
        var self = this;
        element.addEventListener("click", () => {
            self.close();
            callback(element);
            return false;
        });
        return element;
    }

    add_menu(label) {
        let wrapper = create(this.container, "div", "context-menu-item context-submenu");
        let item = create(wrapper, "span", "context-submenu-title");
        item.innerHTML = label;
        let menu = create(wrapper, "div", "context-submenu-container");
        menu.addItem = (label, callback) => {
            let element = create(menu, "div", "context-menu-item");
            element.innerHTML = label;
            element.addEventListener("click", (event) => {
                event.stopPropagation();
                callback(element);
            });
            return element;
        }
        return menu;
    }
    
    open(x, y) {
        let width = 0;
        let height = 0;
        this.container.querySelectorAll(".context-menu > .context-menu-item").forEach(item => {
            let bounds = item.getBoundingClientRect();
            width = Math.max(width, bounds.width);
            height += bounds.height;
        });
        width += 8; // padding
        height += 8; // padding
        x = Math.max(0, Math.min(window.innerWidth - width, x));
        y = Math.max(0, Math.min(window.innerHeight - height, y));
        this.container.style.left = x + "px";
        this.container.style.top = y + "px";
        this.container.classList.add("active");
    }
    
    close() {
        this.reset();
    }

}


class Sheet {

    constructor(sid, container, readonly=false) {
        this.sid = sid;

        // Config
        this.width = 4;
        this.height = 10;
        this.values = [];
        this.columnNames = [];
        this.columnWidths = [];
        this.columnTypes = [];
        this.rowHeights = [];
        this.filters = [];
        this.highlights = {};
        this.readonly = readonly;
        this.ordering = null;

        // DOM
        this.container = container;
        this.toolbar = null;
        this.toolbarButtonSave = null;
        this.toolbarButtonToggleShrink = null;
        this.table = null;
        this.cells = [];
        this.columnHandles = [];
        this.rowHandles = [];
        this.rows = [];
        this.columnHeads = [];
        this.rowHeads = [];
        
        // Flags
        this.selecting = false;
        this.selectingRows = false;
        this.selectingColumns = false;
        this.editing = false;
        this.editingColumnName = false;
        this.resizing = false;
        
        // Attributes
        this.resizingStart = null;
        this.resizingColumn = null;
        this.resizingRow = null;
        this.selection = new Selection(this);
        this.contextMenu = new ContextMenu();
        this.filteredRows = new Set();
        this.script = null;
        this.shrunk = false;
    }

    onChange(dataChanged, configChanged) {
        if (dataChanged) {
            this.evaluateScript();
        }
        if (this.toolbarButtonSave != null) {
            this.toolbarButtonSave.removeAttribute("disabled");
        }
    }

    indexOfRows(rowName) {
        return parseInt(rowName) - 1;
    }

    indexOfColumns(columnName) {
        return this.columnNames.indexOf(columnName);
    }

    startSelection(i, j) {
        let root = this.selection.root();
        let wasRoot = i == root.i && j == root.j;
        if (this.editing && !wasRoot) {
            this.stopEditing();
        }
        this.selecting = true;
        this.selection.start(i, j, this.selectingRows, this.selectingColumns);
        this.selection.set();
    }

    addSelection(i, j) {
        if (this.editing) this.stopEditing();
        this.selecting = true;
        this.selection.add(i, j, this.selectingRows, this.selectingColumns);
        this.selection.set();
    }

    updateSelection(i, j) {
        this.selection.update(this.selectingColumns ? this.height - 1 : i, this.selectingRows ? this.width - 1 : j);
        this.selection.set();
    }

    endSelection() {
        this.selecting = false;
        this.selectingRows = false;
        this.selectingColumns = false;
        this.selection.set();
    }

    getSelectionAsTsv() {
        if (this.selection == null) return "";      
        let bounds = this.selection.bounds();
        let array = [];
        for (let i = bounds.top; i <= bounds.bottom; i++) {
            if (!this.filteredRows.has(i) || !this.selection.containsRow(i)) continue;
            array.push([]);
            let k = array.length - 1;
            for (let j = bounds.left; j <= bounds.right; j++) {
                if (!this.selection.containsColumn(j)) continue;
                array[k].push(this.columnTypes[j].formatText(this.values[i][j]));
            }
        }  
        return formatTsv(array);
    }

    startEditing(causedByClick=false) {
        this.editing = true;
        let root = this.selection.root();
        let cell = this.cells[root.i][root.j];
        let value = this.values[root.i][root.j];
        let input = create(cell, "textarea", "sheet-cell-input");
        input.value = this.columnTypes[root.j].formatText(value);
        if (causedByClick) {
            setTimeout(() => {
                input.focus();
            }, 1);
        } else {
            input.value = "";
            input.focus();
        }
    }

    startEditingColumnName(j) {
        var self = this;
        this.selection.reset();
        this.selection.clear();
        this.editingColumnName = true;
        let input = document.createElement("input");
        input.classList.add("sheet-column-name-input");
        input.value = this.columnNames[j];
        input.placeholder = colname(j);
        function saveColumnName() {
            self.setColumnName(j, input.value.trim());
        }
        function stopEditingColumnName() {
            saveColumnName();
            self.editingColumnName = false;
            remove(input);
        }
        input.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        input.addEventListener("change", saveColumnName);
        input.addEventListener("blur", stopEditingColumnName);
        input.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
                event.preventDefault();
                stopEditingColumnName();
            } else if (event.key == "Tab") {
                event.preventDefault();
                let target = null;
                if (event.shiftKey) {
                    target = j - 1;
                } else {
                    target = j + 1;
                }
                stopEditingColumnName();
                if (target >= 0 && target < self.width) {
                    self.startEditingColumnName(target);
                }
            }
        });
        this.columnHeads[j].appendChild(input);
        input.focus();
        input.select();
    }

    setCellContent(i, j) {
        this.cells[i][j].innerHTML = "";
        let key = `${i},${j}`;
        if (key in this.highlights) {
            let highlight = create(this.cells[i][j], "span", "highlight");
            if (this.highlights[key] == HIGHLIGHT_ACCENT) {
                highlight.classList.add("highlight-accent");
            } else if (this.highlights[key] == HIGHLIGHT_SUCCESS) {
                highlight.classList.add("highlight-success");
            } else if (this.highlights[key] == HIGHLIGHT_ERROR) {
                highlight.classList.add("highlight-error");
            }
        }
        let wrapper = create(this.cells[i][j], "span", "sheet-cell-content");
        if (this.values[i][j] == null) return;
        wrapper.innerHTML = this.columnTypes[j].formatHtml(this.values[i][j]);
    }

    stopEditing() {
        this.editing = false;
        let root = this.selection.root();
        let cell = this.cells[root.i][root.j];
        let input = cell.querySelector(".sheet-cell-input");
        if (input == null) {
            //console.warn("Tried to stop editing an empty cell:", cell);
            return;
        }
        let value = this.columnTypes[root.j].parse(input.value);
        this.values[root.i][root.j] = value;
        remove(input);
        this.setCellContent(root.i, root.j);
        this.onChange(true, false);
    }

    getCursorRow(y) {
        for (let i = 0; i < this.height; i++) {
            let bounds = this.cells[i][0].getBoundingClientRect();
            if (y >= bounds.top && y <= bounds.bottom) {
                return i;
            }
            if (i == 0 && y < bounds.top) {
                return 0;
            }
        }
        return this.height - 1;
    }

    getCursorColumn(x) {
        for (let j = 0; j < this.width; j++) {
            let bounds = this.cells[0][j].getBoundingClientRect();
            if (x >= bounds.left && x <= bounds.right) {
                return j;
            }
            if (j == 0 && x < bounds.left) {
                return 0;
            }
        }
        return this.width - 1;
    }

    startResizingColumn(j, event) {
        this.resizing = true;
        this.resizingColumn = j;
        this.resizingStart = event.clientX;
    }

    startResizingRow(i, event) {
        this.resizing = true;
        this.resizingRow = i;
        this.resizingStart = event.clientY;
    }

    updateResizingColumn(event) {
        let dx = event.clientX - this.resizingStart;
        let width = Math.max(MINIMUM_COLUMN_WIDTH, this.columnWidths[this.resizingColumn] + dx);
        this.setColumnWidth(this.resizingColumn, width);
        this.resizingStart = event.clientX;
    }

    setColumnWidth(j, width) {
        this.columnWidths[j] = parseFloat(width);
        this.columnHeads[j].style.width = this.columnWidths[j] + "px";
        for (let i = 0; i < this.height; i++) {
            this.cells[i][j].style.width = width + "px";
        }
        let x = FIRST_COLUMN_WIDTH;
        for (let k = 0; k < this.width; k++) {
            x += this.columnWidths[k];
            this.columnHandles[k].style.left = (x - HANDLE_SIZE/2) + "px";
        }
        this.onChange(false, true);
    }

    setRowHeight(i, height) {
        this.rowHeights[i] = height;
        this.rowHeads[i].style.height = this.rowHeights[i] + "px";
        let y = 0;
        for (let k = 0; k < this.height; k++) {
            if (!this.rowHandles[k].classList.contains("hidden")) {
                y += this.rowHeights[k];
            }
            this.rowHandles[k].style.top = (y - HANDLE_SIZE/2) + "px";
        }
        this.onChange(false, true);
    }

    updateResizingRow(event) {
        let dy = event.clientY - this.resizingStart;
        let height = Math.max(this.shrunk ? SHRUNK_ROW_HEIGHT : MINIMUM_ROW_HEIGHT, this.rowHeights[this.resizingRow] + dy);
        this.setRowHeight(this.resizingRow, height);
        this.resizingStart = event.clientY;
    }

    updateResizing(event) {
        if (this.resizingColumn != null) {
            this.updateResizingColumn(event);
        }
        if (this.resizingRow != null) {
            this.updateResizingRow(event);
        }
    }

    endResizing() {
        this.resizing = false;
        this.resizingStart = null;
        this.resizingRow = null;
        this.resizingColumn = null;
    }

    autoResizeColumn(j) {
        let maxWidth = MINIMUM_COLUMN_WIDTH;
        for (let i = 0; i < this.height; i++) {
            let wrapper = this.cells[i][j].querySelector(".sheet-cell-content");
            if (wrapper == null) continue;
            let width = wrapper.getBoundingClientRect().width;
            maxWidth = Math.max(maxWidth, width);
        }
        this.setColumnWidth(j, maxWidth);
    }

    autoResizeRow(i) {
        let maxHeight = this.shrunk ? SHRUNK_ROW_HEIGHT : MINIMUM_ROW_HEIGHT;
        for (let j = 0; j < this.width; j++) {
            let wrapper = this.cells[i][j].querySelector(".sheet-cell-content");
            if (wrapper == null) continue;
            let height = wrapper.getBoundingClientRect().height;
            maxHeight = Math.max(maxHeight, height);
        }
        this.setRowHeight(i, maxHeight);
    }

    insertColumn(j) {
        if (this.editing) this.stopEditing();
        let n = prompt("How many columns to insert?", 1);
        if (n != null) {
            n = parseInt(n);
            for (let p = 0; p < n; p++) {
                for (let k = j; k < this.width; k++) {
                    if (this.columnNames[k] == colname(k)) {
                        this.columnNames[k] = colname(k + 1);
                    }
                }
                this.width++;
                this.columnNames.splice(j, 0, colname(j));
                this.columnWidths.splice(j, 0, DEFAULT_COLUMN_WIDTH);
                this.columnTypes.splice(j, 0, new COLUMN_TYPES[CTYPE_TEXT]());
                this.filters.splice(j, 0, new Set());
                for (let i = 0; i < this.height; i++) {
                    this.values[i].splice(j, 0, null);
                }
            }
            this.inflate();
            this.onChange(true, false);
        }
    }

    deleteColumn(j) {
        if (this.editing) this.stopEditing();
        this.selection.clear();
        this.selection.reset();
        for (let k = j+1; k < this.width; k++) {
            if (this.columnNames[k] == colname(k)) {
                this.columnNames[k] = colname(k - 1);
            }
        }
        this.width--;
        this.columnNames.splice(j, 1);
        this.columnWidths.splice(j, 1);
        this.columnTypes.splice(j, 1);
        this.filters.splice(j, 1);
        for (let i = 0; i < this.height; i++) {
            this.values[i].splice(j, 1);
        }
        this.inflate();
        this.onChange(true, false);
    }

    insertRow(i) {
        if (this.editing) this.stopEditing();
        let n = prompt("How many rows to insert?", 1);
        if (n != null) {
            n = parseInt(n);
            for (let p = 0; p < n; p++) {
                this.height++;
                this.rowHeights.splice(i, 0, this.shrunk ? SHRUNK_ROW_HEIGHT : DEFAULT_ROW_HEIGHT);
                let row = [];
                for (let j = 0; j < this.width; j++) {
                    row.push(null);
                }
                this.values.splice(i, 0, row);
            }
            this.inflate();
            this.onChange(true, false);
        }
    }

    deleteRow(i) {
        if (this.editing) this.stopEditing();
        this.selection.clear();
        this.selection.reset();
        this.height--;
        this.rowHeights.splice(i, 1);
        this.values.splice(i, 1);
        this.inflate();
        this.onChange(true, false);
    }

    toggleFilter(j, value) {
        this.onChange(false, true);
        if (this.filters[j].has(value)) {
            this.filters[j].delete(value);
            return false;
        } else {
            this.filters[j].add(value);
            return true;
        }
    }

    openColumnContextMenu(x, y, j) {
        this.contextMenu.reset();
        var self = this;
        let type_menu = this.contextMenu.add_menu("Type");
        COLUMN_TYPES.forEach(ctype => {
            let el = type_menu.addItem(ctype.LABEL, () => {
                self.setColumnType(j, ctype.ID);
                type_menu.querySelectorAll(".selected").forEach(e => {
                    e.classList.remove("selected");
                });
                el.classList.add("selected");
            });
            if (ctype.ID == this.columnTypes[j].constructor.ID) {
                el.classList.add("selected");
            }
        });
        let values = Array.from(this.getValueSet(j));
        if (values.length < 20) {
            let filter_menu = this.contextMenu.add_menu("Filter");
            values.sort();
            values.splice(0, 0, null);
            values.forEach(value => {
                let el = filter_menu.addItem(`<input type="checkbox" ${this.filters[j].has(value) ? "" : "checked"} /> ${value == null ? "(Empty)" : value}`, () => {
                    el.querySelector("input").checked = !self.toggleFilter(j, value);
                    self.updateFilters();
                });
            });
        }
        this.contextMenu.addItem("Resize", () => {
            let newWidth = prompt(`Column width (default is ${DEFAULT_COLUMN_WIDTH}):`, self.columnWidths[j]);
            if (newWidth != null) {    
                self.selection.columns().forEach(q => {
                    self.setColumnWidth(q, newWidth);
                });
            }
        });
        this.contextMenu.addItem("Insert left", () => {
            let bounds = self.selection.bounds();
            self.insertColumn(bounds.left);
            self.selection.move(0, 1, true);
        });
        this.contextMenu.addItem("Insert right", () => {
            let bounds = self.selection.bounds();
            self.insertColumn(bounds.right + 1);
        });
        this.contextMenu.addItem("Delete", () => {
            let columnsToDelete = self.selection.columns();
            columnsToDelete.sort((a, b) => a - b);
            columnsToDelete.reverse();
            columnsToDelete.forEach(k => self.deleteColumn(k));
        });
        this.contextMenu.addItem("Copy values", () => {
            let strings = [];
            self.getValueSet(j).forEach(value => {
                strings.push(self.columnTypes[j].formatText(value));
            });
            navigator.clipboard.writeText(strings.join("\n"));
        });
        this.contextMenu.open(x, y);
    }

    openRowContextMenu(x, y, i) {
        this.contextMenu.reset();
        var self = this;
        this.contextMenu.addItem("Resize", () => {
            let newHeight = prompt(`Row height (default is ${DEFAULT_ROW_HEIGHT}):`, self.rowHeights[i]);
            if (newHeight != null) {
                self.selection.rows().forEach(p => {
                    self.setRowHeight(p, newHeight);
                });
            }
        });
        this.contextMenu.addItem("Insert top", () => {
            let bounds = self.selection.bounds();
            self.insertRow(bounds.top);
            self.selection.move(1, 0, true);
        });
        this.contextMenu.addItem("Insert bottom", () => {
            let bounds = self.selection.bounds();
            self.insertRow(bounds.bottom + 1);
        });
        this.contextMenu.addItem("Delete", () => {
            let rowsToDelete = self.selection.rows();
            rowsToDelete.sort((a, b) => a - b);
            rowsToDelete.reverse();
            rowsToDelete.forEach(k => self.deleteRow(k));
        } );
        this.contextMenu.open(x, y);
    }

    setColumnType(j, ctype) {
        let oldCtype = this.columnTypes[j];
        let newCtype = new (COLUMN_TYPES[ctype])();
        this.columnTypes[j] = newCtype;
        for (let i = 0; i < this.height; i++) {
            this.cells[i][j].classList.remove(oldCtype.constructor.ALIGNEMENT);
            this.cells[i][j].classList.add(newCtype.constructor.ALIGNEMENT);
            if (this.values[i][j] == null) continue;
            this.values[i][j] = newCtype.parse(oldCtype.formatText(this.values[i][j]));
            this.setCellContent(i, j);
        }
        this.onChange(true, true);
    }

    setColumnName(j, name) {
        this.columnNames[j] = name.trim() == "" ? colname(j) : name.trim();
        let el = this.columnHeads[j].querySelector(".sheet-column-name"); 
        el.textContent = this.columnNames[j];
        el.title = this.columnNames[j];
        this.onChange(true, false);
    }

    sortRows(j, ascending) {
        // TODO: use ctype comparator?
        let order = [];
        var self = this;
        for (let i = 0; i < this.height; i++) {
            order.push(i);
        }
        if (j == null) {
            if (this.ordering == null) return;
            for (let i = 0; i < this.height; i++) {
                order[i] = this.ordering.indexOf(i);
            }
        } else {
            order.sort((p, q) => {
                let a = self.values[p][j];
                let b = self.values[q][j];
                if (a == null && b == null) return 0;
                if (a == null) return -1;
                if (b == null) return 1;
                if (a < b) return -1;
                if (a > b) return 1;
                return 0;
            });
        }
        if (!ascending) order.reverse();
        if (this.ordering == null) {
            this.ordering = order;
        } else {
            this.ordering = tidy(this.ordering, order);
        }
        this.values = tidy(this.values, order);
        this.rowHeights = tidy(this.rowHeights, order);
        this.inflate();
        this.container.querySelectorAll(`.sheet-column-sort`).forEach(element => {
            element.classList.remove("ascending");
            element.classList.remove("descending");
        });
        if (j != null) this.columnHeads[j].querySelector(".sheet-column-sort").classList.add(ascending ? "ascending" : "descending");
        this.setRowNames();
        this.onChange(true, true);
    }

    updateFilters() {
        this.filteredRows = new Set();
        let y = 0;
        let rowTop = 0;
        for (let i = 0; i < this.height; i++) {
            let shouldBeDisplayed = true;
            for (let j = 0; j < this.width; j++) {
                if (this.filters[j].has(this.values[i][j])) {
                    shouldBeDisplayed = false;
                    break;
                }
            }
            if (shouldBeDisplayed) {
                this.filteredRows.add(i);
                y += this.rowHeights[i] - 1;
                this.rows[i].classList.remove("hidden");
                this.rowHandles[i].classList.remove("hidden");
                //this.rowHandles[i].style.top = (y - HANDLE_SIZE/2) + "px";
                //this.rows[i].style.top = `${rowTop}px`;
                rowTop--;
            } else {
                this.rows[i].classList.add("hidden");
                this.rowHandles[i].classList.add("hidden");
            }
        }
        this.selection.setFilteredRanges();
        this.selection.set();
    }

    setCellsEventListeners() {
        var self = this;
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                this.cells[i][j].addEventListener("mousedown", (event) => {
                    let inSelection = self.selection.contains(i, j);
                    if (event.ctrlKey && !inSelection) {
                        self.addSelection(i, j);
                    } else if (event.shiftKey  && !inSelection) {
                        self.updateSelection(i, j);
                    } else if (!event.ctrlKey && !event.shiftKey) {
                        self.startSelection(i, j);
                    }
                });
                this.cells[i][j].addEventListener("dblclick", () => {
                    if (!self.editing && !self.readonly) self.startEditing(true);
                });
                this.cells[i][j].addEventListener("mousemove", () => {
                    if (self.selecting) {
                        self.updateSelection(i, j);
                    }
                });
            }
        }
        for (let j = 0; j < this.width; j++) {
            let handle = this.columnHandles[j];
            handle.addEventListener("mousedown", (event) => {
                if (!self.readonly) {
                    self.startResizingColumn(j, event);
                }
            });
            handle.addEventListener("dblclick", () => {
                if (!self.readonly) {
                    self.autoResizeColumn(j);
                }
            });
        }
        for (let i = 0; i < this.height; i++) {
            let handle = this.rowHandles[i];
            handle.addEventListener("mousedown", (event) => {
                if (!self.readonly) {
                    self.startResizingRow(i, event);
                }
            });
            handle.addEventListener("dblclick", () => {
                if (!self.readonly) {
                    self.autoResizeRow(i);
                }
            });
        }
        for (let i = 0; i < this.height; i++) {
            this.rowHeads[i].addEventListener("mousedown", (event) => {
                if (event.button == 0) {
                    self.selectingRows = true;
                    self.startSelection(i, 0);
                }
            });
            this.rowHeads[i].addEventListener("contextmenu", (event) => {
                event.preventDefault();
                if (!self.selection.containsRow(i)) {
                    self.selectingRows = true;
                    self.startSelection(i, 0);
                    self.endSelection();
                }
                if (!self.readonly) {
                    self.openRowContextMenu(event.clientX, event.clientY, i);
                }
            });
            this.rowHeads[i].addEventListener("mousemove", () => {
                if (self.selecting) {
                    self.updateSelection(i, 0);
                }
            });
        }
        let cellTopLeft = this.container.querySelector(".sheet-row-head .sheet-cell:first-child");
        cellTopLeft.addEventListener("click", () => {
            self.selection.all();
        });
        cellTopLeft.addEventListener("dblclick", () => {
            self.sortRows(null, true);
            self.selection.reset();
            self.selection.clear();
        });
        for (let j = 0; j < this.width; j++) {
            this.columnHeads[j].addEventListener("mousedown", (event) => {
                if (event.button == 0) {
                    self.selectingColumns = true;
                    self.startSelection(0, j);
                }
            });
            this.columnHeads[j].addEventListener("contextmenu", (event) => {
                event.preventDefault();
                if (!self.selection.containsColumn(j)) {
                    self.selectingColumns = true;
                    self.startSelection(0, j);
                    self.endSelection();
                }
                if (!self.readonly) {
                    self.openColumnContextMenu(event.clientX, event.clientY, j);
                }
            });
            this.columnHeads[j].addEventListener("mousemove", () => {
                if (self.selecting) {
                    self.updateSelection(0, j);
                }
            });
            let cellSort = this.columnHeads[j].querySelector(".sheet-column-sort");
            cellSort.addEventListener("click", (event) => {
                self.sortRows(j, !cellSort.classList.contains("ascending"));
            });
            let cellName = this.columnHeads[j].querySelector(".sheet-column-name");
            cellName.addEventListener("dblclick", (event) => {
                if (!self.readonly) {
                    self.startEditingColumnName(j);
                }
            });
        }
    }

    toggleMarker(marker) {
        let enabled = null;
        let regexLeft = new RegExp(`^${marker.replaceAll("*", "\\*")}`);
        let regexRight = new RegExp(`${marker.replaceAll("*", "\\*")}$`);
        this.selection.iterate((i, j) => {
            if (this.columnTypes[j].constructor.ID == CTYPE_TEXT) {
                if (enabled == null) {
                    enabled = this.values[i][j].startsWith(marker) && this.values[i][j].endsWith(marker);
                }
                if (enabled) {
                    this.values[i][j] = this.values[i][j].replace(regexLeft, "").replace(regexRight, "")
                } else {
                    this.values[i][j] = marker + this.values[i][j] + marker;
                }
                this.setCellContent(i, j);
            }
        });
        this.onChange(true, false);
    }

    toggleBold() {
        this.toggleMarker("**");
    }

    toggleItalic() {
        this.toggleMarker("*");
    }

    setGlobalEventListeners() {
        var self = this;
        this.container.addEventListener("paste", (event) => {
            if (self.readonly) return;
            if (self.selection != null && !self.editing) {
                event.preventDefault();
                let string = event.clipboardData.getData("text");
                let array = parseTsv(string);
                let root = self.selection.root();
                if (array.length == 1 && array[0].length == 1) {
                    self.selection.iterate((i, j) => {
                        self.values[i][j] = self.columnTypes[j].parse(array[0][0]);
                        self.setCellContent(i, j);
                    });
                } else {
                    self.selection.reset();
                    self.selection.start(root.i, root.j);
                    self.selection.update(
                        Math.min(self.height - 1, root.i + array.length - 1),
                        Math.min(self.width - 1, root.j + array[0].length - 1)
                    )
                    self.selection.iterate((i, j) => {
                        self.values[i][j] = self.columnTypes[j].parse(array[i - root.i][j - root.j]);
                        self.setCellContent(i, j);
                    });
                }
                self.onChange(true, false);
            }
        });
        document.addEventListener("mousemove", (event) => {
            if (self.resizing && !self.readonly) {
                self.updateResizing(event);
            }
        });
        document.addEventListener("mouseup", () => {
            if (self.selecting) {
                self.endSelection();
            }
            if (self.resizing && !self.readonly) {
                self.endResizing();
            }
        });
        document.addEventListener("keydown", (event) => {
            if (self.editingColumnName) {
                //pass
            } else if (event.key == "a" && event.ctrlKey && !self.editing) {
                self.selection.all();
                event.preventDefault();
            } else if (event.key == "s" && event.ctrlKey && !self.readonly) {
                event.preventDefault();
                self.saveData();
            } else if (self.selection != null) {
                if (event.key == "Enter") {
                    if (event.altKey && self.editing) {
                        if (!self.readonly) {
                            let root = self.selection.root();
                            let textarea = self.cells[root.i][root.j].querySelector(".sheet-cell-input");
                            let startPos = textarea.selectionStart;
                            let endPos = textarea.selectionEnd;
                            textarea.value = textarea.value.substring(0, startPos) + "\n" + textarea.value.substring(endPos)
                            textarea.scrollTop = textarea.scrollHeight;
                            textarea.setSelectionRange(startPos + 1, endPos + 1);
                        }
                    } else {
                        if (self.editing && !self.readonly) self.stopEditing();
                        self.selection.move(1, 0);
                    }
                } else if (event.key == "ArrowUp" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(-1, 0);
                    } else {
                        self.selection.move(-1, 0, event.ctrlKey);
                    }
                } else if (event.key == "ArrowDown" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(1, 0);
                    } else {
                        self.selection.move(1, 0, event.ctrlKey);
                    }
                } else if (event.key == "ArrowLeft" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(0, -1);
                    } else {
                        self.selection.move(0, -1, event.ctrlKey);
                    }
                } else if (event.key == "ArrowRight" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(0, 1);
                    } else {
                        self.selection.move(0, 1, event.ctrlKey);
                    }
                } else if (event.key == "Home" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(-self.height, -self.width);
                    } else {
                        self.selection.move(-self.height, -self.width, event.ctrlKey);
                    }
                } else if (event.key == "End" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(self.height, self.width);
                    } else {
                        self.selection.move(self.height, self.width, event.ctrlKey);
                    }
                } else if (event.key == "PageUp" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(-16, 0);
                    } else {
                        self.selection.move(-16, 0, event.ctrlKey);
                    }
                } else if (event.key == "PageDown" && !self.editing) {
                    event.preventDefault();
                    if (event.shiftKey) {
                        self.selection.expand(16, 0);
                    } else {
                        self.selection.move(16, 0, event.ctrlKey);
                    }
                } else if (!self.editing && (event.key == "Delete" || event.key == "Backspace") && !self.readonly) {
                    self.selection.iterate((i, j) => {
                        self.values[i][j] = null;
                        self.setCellContent(i, j);
                    });
                    self.onChange(true, false);
                } else if (event.key == "Tab") {
                    if (self.editing && !self.readonly) self.stopEditing();
                    if (event.shiftKey) {
                        self.selection.move(0, -1);
                    } else {
                        self.selection.move(0, 1);
                    }
                    event.preventDefault();
                } else if (event.key == "b" && event.ctrlKey && !self.readonly) {
                    event.preventDefault();
                    self.toggleBold();
                } else if (event.key == "i" && event.ctrlKey && !self.readonly) {
                    event.preventDefault();
                    self.toggleItalic();
                } else if (event.key == "k" && event.ctrlKey && !self.readonly) {
                    let root = self.selection.root();
                    let value = self.values[root.i][root.j];
                    if (value != null && typeof(value) == typeof("")) {
                        if (value.match(MARKDOWN_PATTERN_LINK)) {
                            let match = MARKDOWN_PATTERN_LINK.exec(value);
                            let url = prompt("Current URL:", match[2]);
                            if (url == null || url.trim() == "") {
                                self.values[root.i][root.j] = match[1];
                            } else {
                                self.values[root.i][root.j] = `[${match[1]}](${url})`;
                            }
                            self.setCellContent(root.i, root.j);
                            self.onChange(true, false);
                        } else {
                            let url = prompt("Enter a URL:");
                            if (url != null && url.trim() != "") {
                                self.values[root.i][root.j] = `[${value}](${url})`;
                                self.setCellContent(root.i, root.j);
                                self.onChange(true, false);
                            }
                        }
                    }
                } else if (event.key == "c" && event.ctrlKey) {
                    event.preventDefault();
                    let string = self.getSelectionAsTsv();
                    navigator.clipboard.writeText(string);
                } else if (event.altKey && (event.key == "²" || event.key == "&" || event.key == "é" || event.key == "\"") && !self.readonly) {
                    if (event.key == "²") {
                        self.selection.iterate((i, j) => {
                            let key = `${i},${j}`;
                            if (key in self.highlights) {
                                delete self.highlights[key];
                                self.setCellContent(i, j);
                            }
                        });
                    } else {
                        let highlight = null;
                        if (event.key == "&") {
                            highlight = HIGHLIGHT_ACCENT;
                        } else if (event.key == "é") {
                            highlight = HIGHLIGHT_SUCCESS;
                        } else if (event.key == "\"") {
                            highlight = HIGHLIGHT_ERROR;
                        }
                        self.selection.iterate((i, j) => {
                            let key = `${i},${j}`;
                            self.highlights[key] = highlight;
                            self.setCellContent(i, j);
                        });
                    }
                    self.onChange(false, true);
                } else if (!self.editing && event.key.length == 1 && !event.ctrlKey && !event.altKey && !self.readonly) {
                    //console.log(event.key);
                    self.startEditing();
                }
            }
        });
    }

    getValueSet(j) {
        let vset = new Set();
        for (let i = 0; i < this.height; i++) {
            if (this.values[i][j] == null) continue;
            vset.add(this.values[i][j]);
        }
        return Array.from(vset);
    }

    toggleShrink() {
        this.shrunk = !this.shrunk;
        for (let i = 0; i < this.height; i++) {
            if (this.shrunk && this.rowHeights[i] == DEFAULT_ROW_HEIGHT) {
                this.rowHeights[i] = SHRUNK_ROW_HEIGHT;
            } else if (!this.shrunk && this.rowHeights[i] == SHRUNK_ROW_HEIGHT) {
                this.rowHeights[i] = DEFAULT_ROW_HEIGHT;
            }
        }
        this.inflate();
        this.onChange(false, true);
    }

    // inflateTable() {
    //     this.table = create(this.container, "div", "sheet-table");
    // }

    setRowNames() {
        for (let i = 0; i < this.height; i++) {
            this.rowHeads[i].innerHTML = `<span class="sheet-cell-content">${this.ordering == null ? rowname(i) : rowname(this.ordering[i])}</span>`;
        }
    }

    inflate() {
        if (this.shrunk) {
            this.container.classList.add("sheet-shrink");
            if (this.toolbarButtonToggleShrink != null) {
                this.toolbarButtonToggleShrink.classList.add("active");
            }
        } else {
            this.container.classList.remove("sheet-shrink");
            if (this.toolbarButtonToggleShrink != null) {
                this.toolbarButtonToggleShrink.classList.remove("active");
            }
        }
        let tableHead = this.container.querySelector(".sheet-head");
        tableHead.innerHTML = "";
        let tableBody = this.container.querySelector(".sheet-body");
        tableBody.innerHTML = "";

        let rowHead = create(tableHead, "div", "sheet-row sheet-row-head");
        let cellTopLeft = create(rowHead, "div", "sheet-cell sheet-cell-head sheet-cell-top-left");
        cellTopLeft.style.height = (this.shrunk ? SHRUNK_ROW_HEIGHT : DEFAULT_ROW_HEIGHT) + "px";
        this.columnHeads = [];
        for (let j = 0; j < this.width; j++) {
            this.columnHeads.push(create(rowHead, "div", "sheet-cell"));
            this.columnHeads[j].style.width = this.columnWidths[j] + "px";
            let shelf = create(this.columnHeads[j], "div", "sheet-cell-shelf");
            let cellSort = create(shelf, "span", "sheet-cell-shelf-item sheet-column-sort");
            cellSort.title = "Sort";
            let cellName = create(shelf, "span", "sheet-cell-shelf-item sheet-column-name");
            cellName.textContent = this.columnNames[j];
            cellName.title = this.columnNames[j];
        }

        let x = FIRST_COLUMN_WIDTH;
        this.columnHandles = [];
        for (let j = 0; j < this.width; j++) {
            this.columnHandles.push(create(rowHead, "span", "handle handle-column"));
            x += this.columnWidths[j];
            this.columnHandles[j].style.left = (x - HANDLE_SIZE/2) + "px";
        }

        this.cells = [];
        this.rows = [];
        this.rowHeads = [];
        for (let i = 0; i < this.height; i++) {
            this.rows.push(create(tableBody, "div", "sheet-row"));
            this.rowHeads.push(create(this.rows[i], "div", "sheet-cell sheet-cell-head"));
            this.rowHeads[i].style.height = this.rowHeights[i] + "px";
            this.cells.push([]);
            for (let j = 0; j < this.width; j++) {
                const cell = create(this.rows[i], "div", `sheet-cell ${this.columnTypes[j].constructor.ALIGNEMENT}`);
                this.cells[i].push(cell);
                cell.style.width = this.columnWidths[j] + "px";
                this.setCellContent(i, j);
            }
        }
        this.setRowNames();

        let y = 0;
        this.rowHandles = [];
        for (let i = 0; i < this.height; i++) {
            this.rowHandles.push(create(tableBody, "span", "handle handle-row"));
            this.rowHandles[i].setAttribute("i", i);
            y += this.rowHeights[i];
            this.rowHandles[i].style.top = (y - HANDLE_SIZE/2) + "px";
        }

        this.updateFilters();

        this.setCellsEventListeners();
    }

    initializeValues(data=null, config=null) {
        if (data != null) {
            this.height = data.length - 1;
            this.width = data[0].length;
        }
        if (config != null) {
            this.highlights = config.highlights;
            this.shrunk = config.shrunk;
            this.ordering = config.ordering;
            if (("column_widths" in config) && !("columnWidths" in config)) {
                config.columnWidths = config["column_widths"];
            }
            if (("column_types" in config) && !("columnTypes" in config)) {
                config.columnTypes = config["column_types"];
            }
            if (("row_heights" in config) && !("rowHeights" in config)) {
                config.rowHeights = config["row_heights"];
            }
        }

        this.columnNames = [];
        this.columnTypes = [];
        this.columnWidths = [];
        for (let j = 0; j < this.width; j++) {
            if (config == null) {
                this.columnWidths.push(DEFAULT_COLUMN_WIDTH);
                this.columnTypes.push(new COLUMN_TYPES[CTYPE_TEXT]());
            } else {
                this.columnWidths.push(parseFloat(config.columnWidths[j]));
                this.columnTypes.push(new COLUMN_TYPES[config.columnTypes[j]]());
            }
            if (data == null || data[0][j].trim() == "") {
                this.columnNames.push(colname(j));
            } else {
                this.columnNames.push(data[0][j]);
            }
            this.filters.push(new Set());
        }
        this.rowHeights = [];
        for (let i = 0; i < this.height; i++) {
            if (config == null) {
                this.rowHeights.push(DEFAULT_ROW_HEIGHT);
            } else {
                this.rowHeights.push(parseFloat(config.rowHeights[i]));
            }
        }
        this.values = [];
        for (let i = 0; i < this.height; i++) {
            this.values.push([]);
            for (let j = 0; j < this.width; j++) {
                if (data == null) {
                    this.values[i].push(null);
                } else {
                    this.values[i].push(this.columnTypes[j].parse(data[i + 1][j]));
                }
            }
        }
        if (config != null) {
            this.script = Script.fromString(config.script);
            this.filters = [];
            config.filters.forEach(array => {
                this.filters.push(new Set(array));
            });
        }
    }

    updateScript(scriptString) {
        if (this.script != null) delete this.script;
        this.script = Script.fromString(scriptString);
        this.evaluateScript();
        this.onChange(false, true);
    }

    evaluateScript() {
        if (this.script == null) return;
        this.script.evaluate(this);
    }

    openImportModal() {
        var self = this;
        const modal = create(document.body, "div", "modal");
        const modalOverlay = create(modal, "span", "modal-overlay");
        modalOverlay.addEventListener("click", () => {
            remove(modal);
        });
        const modalContainer = create(modal, "div", "modal-container");
        const card = create(modalContainer, "div", "card");
        create(card, "h3").textContent = "Import Sheet";
        create(card, "div").textContent = "Upload a CSV or TSV file";
        const inputParagraph = create(card, "p");
        create(inputParagraph, "label").textContent = "Local file";
        const input = create(inputParagraph, "input");
        input.setAttribute("type", "file");
        input.setAttribute("accept", ".tsv,.csv,.txt");
        const bottomRow = create(card, "div", "row");
        const buttonCancel = create(bottomRow, "button");
        buttonCancel.textContent = "Cancel";
        buttonCancel.addEventListener("click", () => {
            remove(modal);
        });
        const buttonImport = create(bottomRow, "button");
        buttonImport.textContent = "Import";
        modal.classList.add("active");
        buttonImport.addEventListener("click", () => {
            if (input.files.length > 0) {
                let reader = new FileReader();
                reader.readAsText(input.files[0]);
                reader.onload = () => {
                    self.importTsv(reader.result.replaceAll("\r", ""));
                }
            }
            remove(modal);
        });
    }

    openScriptModal() {
        var self = this;
        const modal = create(document.body, "div", "modal");
        const modalOverlay = create(modal, "span", "modal-overlay");
        modalOverlay.addEventListener("click", () => {
            remove(modal);
        });
        const modalContainer = create(modal, "div", "modal-container");
        const card = create(modalContainer, "div", "card");
        create(card, "h3").textContent = "Script";
        create(card, "div").textContent = "Write script formula, one per line";
        const textarea = create(create(card, "p"), "textarea", "script-textarea");
        textarea.addEventListener("keydown", (event) => {
            event.stopPropagation();
        });
        if (this.script != null) {
            textarea.value = this.script.string;
        }
        const bottomRow = create(card, "div", "row");
        const buttonCancel = create(bottomRow, "button");
        buttonCancel.textContent = "Cancel";
        buttonCancel.addEventListener("click", () => {
            remove(modal);
        });
        const buttonCompute = create(bottomRow, "button");
        buttonCompute.textContent = "Save";
        buttonCompute.addEventListener("click", () => {
            self.updateScript(textarea.value);
        });
        const buttonSave = create(bottomRow, "button");
        buttonSave.textContent = "Save & close";
        modal.classList.add("active");
        textarea.focus();
        buttonSave.addEventListener("click", () => {
            self.updateScript(textarea.value);
            remove(modal);
        });
    }

    bindToolbar() {
        if (this.readonly) return;
        var self = this;

        this.toolbar = this.container.querySelector(".sheet-toolbar");

        if (this.toolbar == null) return;

        this.toolbarButtonSave = this.toolbar.querySelector(".sheet-button-save");
        this.toolbarButtonSave.setAttribute("disabled", true);
        this.toolbarButtonSave.addEventListener("click", () => {
            self.saveData();
        });

        this.toolbar.querySelector(".sheet-button-script").addEventListener("click", () => {
            self.openScriptModal();
        });

        this.toolbarButtonToggleShrink = this.toolbar.querySelector(".sheet-button-shrink");
        this.toolbarButtonToggleShrink.addEventListener("click", () => {
            self.toggleShrink();
        });

        this.toolbar.querySelector(".sheet-button-upload").addEventListener("click", () => {
            self.openImportModal();
        });

        this.toolbar.querySelector(".sheet-button-download").addEventListener("click", () => {
            self.exportTsv();
        });

        this.toolbar.querySelector(".sheet-button-copy").addEventListener("click", () => {
            const tsvString = this.export().data;
            const splitter = "---\t".repeat(self.width).trim();
            const markdownString = tsvString.replace("\n", "\n" + splitter + "\n").replaceAll("\t", " | ");
            navigator.clipboard.writeText(markdownString);
            toast("Copied as Markdown", TOAST_SHORT);
        });
    }

    setup(data=null, config=null) {
        this.contextMenu.setup();
        this.initializeValues(data, config);
        this.bindToolbar();
        this.inflate();
        this.setGlobalEventListeners();
        this.evaluateScript();
    }

    export() {
        let dataArray = [[]];
        for (let j = 0; j < this.width; j++) {
            dataArray[0].push(this.columnNames[j]);
        }
        for (let i = 0; i < this.height; i++) {
            dataArray.push([]);
            for (let j = 0; j < this.width; j++) {
                dataArray[i + 1].push(this.columnTypes[j].formatText(this.values[i][j]));
            }
        }
        let configObject = {
            columnWidths: [],
            columnTypes: [],
            rowHeights: [],
            script: "",
            filters: [],
            highlights: this.highlights,
            shrunk: this.shrunk,
            ordering: null,
        };
        if (this.ordering != null) {
            configObject.ordering = [];
            for (let i = 0; i < this.height; i++) {
                configObject.ordering.push(this.ordering[i]);
            }
        }
        for (let i = 0; i < this.height; i++) {
            configObject.rowHeights.push(this.rowHeights[i]);
        }
        for (let j = 0; j < this.width; j++) {
            configObject.columnWidths.push(this.columnWidths[j]);
            configObject.columnTypes.push(this.columnTypes[j].constructor.ID);
            configObject.filters.push(Array.from(this.filters[j]));
        }
        if (this.script != null) configObject.script = this.script.string;
        return {
            data: formatTsv(dataArray),
            config: JSON.stringify(configObject)
        };
    }

    importTsv(tsvString) {
        let data = parseTsv(tsvString);
        this.initializeValues(data, null);
        this.inflate();
        this.onChange(true, true);
    }

    exportTsv() {
        let tsvString = this.export().data;
        let blob = new Blob([tsvString], {type: "text/tab-separated-values"});
        let link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        let title = this.container.querySelector(".sheet-title");
        if (title == null) {
            link.download = `Untitled.tsv`;
        } else {
            link.download = `${title.textContent}.tsv`;
        }
        link.click();
    }

    saveData() {
        let sheetExport = this.export();
        apiPost(
            "save-sheet",
            {sid: this.sid, data: sheetExport.data, config: sheetExport.config},
            () => {
                toast("Saved!", 600);
                if (this.toolbarButtonSave != null) {
                    this.toolbarButtonSave.setAttribute("disabled", true);
                }
            });
    }

}


function initializeSheet(sheetSeed, readonly) {
    var sheet = null;
    let sheetId = sheetSeed.getAttribute("sheet-id");
    fetch(URL_API + `?action=sheet&sid=${sheetId}`, {
        method: "get",
        })
        .then(res => res.json())
        .then(sheetData => {
            sheet = new Sheet(sheetId, sheetSeed, readonly);
            let data = null;
            if (sheetData.data != null && sheetData.data.trim() != "") {
                data = parseTsv(sheetData.data);
            }
            let config = null;
            if (sheetData.config != null && sheetData.config.trim() != "") {
                config = JSON.parse(sheetData.config);
            }
            sheet.setup(data, config);
        });

}


function initializeSheets(readonly) {
    document.querySelectorAll(".sheet").forEach(sheetSeed => {
        initializeSheet(sheetSeed, readonly);
    });
}