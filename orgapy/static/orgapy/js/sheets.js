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


function find_closing_parenthesis(string, start=0) {
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

    static from_string(string) {
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

    evaluate(k, min, max, index_of) {
        throw new Error("Not implemented!");
    }

    indices(k, min, max, index_of) {
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

    evaluate(k, min, max, index_of) {
        let l = index_of(this.position);
        if (l < min || l > max) throw new Error(`Index out of bounds: ${l}`);
        return l;
    }

    indices(k, min, max, index_of) {
        return [this.evaluate(k, min, max, index_of)];
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

    evaluate(k, min, max, index_of) {
        let l = k + this.offset;
        if (l < min || l > max) throw new Error(`Index out of bounds: ${l}`);
        return l;
    }

    indices(k, min, max, index_of) {
        return [this.evaluate(k, min, max, index_of)];
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

    evaluate(k, min, max, index_of) {
        throw new Error("Can not evaluate range axis location");
    }

    indices(k, min, max, index_of) {
        let l_min = min;
        if (this.start != null) l_min = Math.max(l_min, index_of(this.start));
        let l_max = max;
        if (this.end != null) l_max = Math.min(l_max, index_of(this.end));
        let indices = [];
        for (let l = l_min; l <= l_max; l++) {
            indices.push(l);
        }
        return indices;
    }

}


class CellLocation {

    constructor(row_location, column_location) {
        this.row = row_location;
        this.column = column_location;
    }

    static from_string(string) {
        let split = string.split(",");
        return new CellLocation(
            AxisLocation.from_string(split[1]),
            AxisLocation.from_string(split[0]));
    }

    toString() {
        return `<${this.row.toString()}, ${this.column.toString()}>`;
    }

    evaluate(sheet, i, j) {
        return {
            i: this.row.evaluate(i, 0, sheet.height - 1, s => sheet.index_of_rows(s)),
            j: this.column.evaluate(j, 0, sheet.width - 1, s => sheet.index_of_columns(s))
        };
    }

    indices(sheet, i, j) {
        let row_indices = this.row.indices(i, 0, sheet.height - 1, s => sheet.index_of_rows(s));
        let column_indices = this.column.indices(j, 0, sheet.width - 1, s => sheet.index_of_columns(s));
        let indices = { idx: [] };
        row_indices.forEach(p => {
            column_indices.forEach(q => {
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

    static from_string(string) {
        let clean = string.trim();
        if (clean == "") return null;
        let left = null;
        let operator = null;
        let right = null;
        let tail = null;
        let constant = null;
        if (clean.charAt(0) == "(") {
            let i = find_closing_parenthesis(clean);
            left = Expression.from_string(clean.substring(1, i).trim());
            tail = clean.substring(i + 1).trim();
        } else if (clean.match(SCRIPT_FUNCTION_PATTERN)) {
            let match = clean.match(SCRIPT_FUNCTION_PATTERN)[0];
            let i = find_closing_parenthesis(clean, match.length - 1);
            let inner_string = clean.substring(match.length, i).trim();
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
                left = new ExpressionBaseFunction(fun, Expression.from_string(inner_string));
            } else {
                left = new ExpressionRangeFunction(fun, CellLocation.from_string(inner_string));
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
            left = new ExpressionCell(CellLocation.from_string(match));
            tail = clean.substring(match.length).trim();
        } else {
            throw new Error("Could not parse expression:", clean);
        }
        if (tail != null && tail != "") {
            let operator_match = tail.match(SCRIPT_OPERATOR_PATTERN)[0];
            switch (operator_match) {
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
            right = Expression.from_string(tail.substring(operator_match.length));
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

    constructor(cell_location) {
        super();
        this.cell_location = cell_location;
    }

    toString() {
        return `<CellLocation: ${this.cell_location.toString()}>`;
    }

    evaluate(sheet, i, j) {
        let position = this.cell_location.evaluate(sheet, i, j);
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
    
    constructor(fun, cell_location) {
        super();
        this.fun = fun;
        this.cell_location = cell_location;
    }

    toString() {
        return `<Function ${this.fun} of range ${this.cell_location.toString()}>`;
    }

    evaluate_sum(indices) {
        let r = 0;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null) r += sheet.values[i][j];
        });
        return r;
    }

    evaluate_mean(indices) {
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

    evaluate_count(indices) {
        let r = 0;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null) r++;
        });
        return r;
    }

    evaluate_min(indices) {
        let r = null;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null && (r == null || sheet.values[i][j] < r)) r = sheet.values[i][j];
        });
        return r;
    }

    evaluate_max(indices) {
        let r = null;
        indices.forEach((i, j) => {
            if (sheet.values[i][j] != null && (r == null || sheet.values[i][j] > r)) r = sheet.values[i][j];
        });
        return r;
    }

    evaluate(sheet, i, j) {
        let indices = this.cell_location.indices(sheet, i, j);
        switch(this.fun) {
            case FUNCTION_SUM:
                return this.evaluate_sum(indices);
            case FUNCTION_MEAN:
                return this.evaluate_mean(indices);
            case FUNCTION_COUNT:
                return this.evaluate_count(indices);
            case FUNCTION_MIN:
                return this.evaluate_min(indices);
            case FUNCTION_MAX:
                return this.evaluate_max(indices);
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

    static from_string(string) {
        let formulas = [];
        string.split("\n").forEach((line, i) => {
            if (line.trim() != "" && line.charAt(0) != "#") {
                //console.log(line);
                try {
                    let split = line.split("=");
                    if (split.length != 2) throw new Error("Syntax error: Could not parse formula");
                    let formula = {
                        location: CellLocation.from_string(split[0]),
                        expression: Expression.from_string(split[1])
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
            formula.location.indices(sheet, 0, 0).forEach((i, j) => {
                sheet.values[i][j] = formula.expression.evaluate(sheet, i, j);
                sheet.set_cell_content(i, j);
            });
        });     
        sheet.update_filters();
    }

}


function tidy(array, order) {
    let buffer = [];
    order.forEach(i => {
        buffer.push(array[i]);
    });
    return buffer;
}


function create(parent, tag="div", classes=null) {
    let el = parent.appendChild(document.createElement(tag));
    if (classes != null) {
        classes.forEach(cls => {
            el.classList.add(cls);
        });
    }
    return el;
}


function remove(element) {
    element.parentNode.removeChild(element);
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
        let in_code = string.charCodeAt(k);
        let digit = in_code <= 57 ? in_code - 48 : in_code - 87;
        let out_code = digit + 65;
        codes.push(out_code);
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
const MARKDOWN_PATTERN_URL = /((?:https?:\/\/)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b(?:[-a-zA-Z0-9@:%_\+.~#?&//=]*))/


function markdown_to_html(string) {
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


function safe_format(value, formatter) {
    if (value == null) return "";
    try {
        return formatter(value);
    } catch {
        return `${value}`;
    }
}


function safe_parse(string, parser) {
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


function parse_tsv(string) {
    let array = [];
    string.split("\n").forEach((line, i) => {
        array.push([]);
        line.split("\t").forEach(item => {
            array[i].push(item);
        });
    });
    return array;
}


function format_tsv(array) {
    let rows = [];
    array.forEach(row => {
        rows.push(row.join("\t"));
    });
    return rows.join("\n");
}


class SelectionRange {

    constructor(sheet, start_i, start_j, end_i=null, end_j=null) {
        this.sheet = sheet;
        this.start_i = start_i;
        this.start_j = start_j;
        this.end_i = end_i == null ? this.start_i : end_i;
        this.end_j = end_j == null ? this.start_j : end_j;
        this.top = null;
        this.bottom = null;
        this.left = null;
        this.right = null;
        this.update_bounds();
    }

    update_bounds() {
        this.top = Math.min(this.start_i, this.end_i);
        this.bottom = Math.max(this.start_i, this.end_i);
        this.left = Math.min(this.start_j, this.end_j);
        this.right = Math.max(this.start_j, this.end_j);
    }

    iterate(inner_callback, outer_callback=null) {
        for (let i = this.top; i <= this.bottom; i++) {
            let top = i == this.top;
            let bottom = i == this.bottom;
            if (outer_callback != null) outer_callback(i, top, bottom);
            for (let j = this.left; j <= this.right; j++) {
                let left = j == this.left;
                let right = j == this.right;
                inner_callback(i, j, top, left, bottom, right);
            }
        }
    }

    contains_row(i) {
        return i >= this.top && i <= this.bottom;
    }

    contains_column(j) {
        return j >= this.left && j <= this.right;
    }

    contains(i, j) {
        return this.contains_row(i) && this.contains_column(j);
    }

    update(i, j) {
        this.end_i = i;
        this.end_j = j;
        this.update_bounds();
    }
    
    actual_di(di) {
        let actual_di = 0;
        let visible_di = 0;
        if (di >= 0) {
            while (visible_di < di && this.bottom + actual_di < this.sheet.height) {
                actual_di++;
                if (this.sheet.filtered_rows.has(this.bottom + actual_di)) visible_di++;
            }
        } else {
            while (visible_di > di && this.top + actual_di >= 0) {
                actual_di--;
                if (this.sheet.filtered_rows.has(this.top + actual_di)) visible_di--;
            }
        }
        return actual_di;
    }

    move(di, dj, keep_shape) {
        di = this.actual_di(di);
        this.start_i = Math.max(0, Math.min(this.sheet.height-1, this.start_i + di));
        this.start_j = Math.max(0, Math.min(this.sheet.width-1, this.start_j + dj));
        if (keep_shape) {
            this.end_i = Math.max(0, Math.min(this.sheet.height-1, this.end_i + di));
            this.end_j = Math.max(0, Math.min(this.sheet.width-1, this.end_j + dj));
        } else {
            this.end_i = this.start_i;
            this.end_j = this.start_j;
        }
        this.update_bounds();
    }

    expand(di, dj) {
        di = this.actual_di(di);
        this.end_i = Math.max(0, Math.min(this.sheet.height-1, this.end_i + di));
        this.end_j = Math.max(0, Math.min(this.sheet.width-1, this.end_j + dj));
        this.update_bounds();
    }

}


class Selection {

    constructor(sheet) {
        this.sheet = sheet;
        this.ranges = [];
        this.filtered_ranges = [];
    }

    root() {
        if (this.ranges.length == 0) return {i: 0, j: 0};
        return {i: this.ranges[0].start_i, j: this.ranges[0].start_j};
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
        for (let k = this.filtered_ranges.length - 1; k >= 0; k--) {
            delete this.filtered_ranges[k];
            this.filtered_ranges.splice(k, 1);
        }
    }

    set() {
        this.clear();
        let selected_rows = new Set();
        let selected_columns = new Set();
        this.filtered_ranges.forEach(range => {
            range.iterate((i, j, top, left, bottom, right) => {
                selected_rows.add(i);
                selected_columns.add(j);
                this.sheet.cells[i][j].classList.add("selected");
                if (top) this.sheet.cells[i][j].classList.add("selected-top");
                if (left) this.sheet.cells[i][j].classList.add("selected-left");
                if (bottom) this.sheet.cells[i][j].classList.add("selected-bottom");
                if (right) this.sheet.cells[i][j].classList.add("selected-right");
            });
        });
        selected_rows.forEach(i => {
            this.sheet.row_heads[i].classList.add("selected");
        });
        selected_columns.forEach(j => {
            this.sheet.column_heads[j].classList.add("selected");
        });
    }

    contains_row(i) {
        for (let k = 0; k < this.ranges.length; k++) {
            if (this.ranges[k].contains_row(i)) return true;
        }
        return false;
    }

    contains_column(j) {
        for (let k = 0; k < this.ranges.length; k++) {
            if (this.ranges[k].contains_column(j)) return true;
        }
        return false;
    }

    contains(i, j) {
        for (let k = 0; k < this.ranges.length; k++) {
            if (this.ranges[k].contains(i, j)) return true;
        }
        return false;
    }

    start(i, j, selecting_rows, selecting_columns) {
        this.reset();
        this.add(i, j, selecting_rows, selecting_columns);
    }

    add(i, j, selecting_rows, selecting_columns) {
        let end_i = selecting_columns ? this.sheet.height - 1 : null;
        let end_j = selecting_rows ? this.sheet.width - 1 : null;
        this.ranges.push(new SelectionRange(this.sheet, i, j, end_i, end_j));
        this.set_filtered_ranges();
    }

    update(i, j) {
        if (this.ranges.length == 0) return;
        this.ranges[this.ranges.length - 1].update(i, j);
        this.set_filtered_ranges();
        this.set();
    }

    all() {
        this.reset();
        this.ranges.push(new SelectionRange(this.sheet, 0, 0, this.sheet.height - 1, this.sheet.width - 1));
        this.set_filtered_ranges();
        this.set();
    }

    iterate(callback) {
        this.filtered_ranges.forEach(range => {
            range.iterate(callback);
        });
    }

    move(di, dj, keep_shape=false) {
        this.ranges.forEach(range => {
            range.move(di, dj, keep_shape);
        });
        // TODO: merge ranges!
        this.set_filtered_ranges();
        this.set();
    }

    expand(di, dj) {
        this.ranges.forEach(range => {
            range.expand(di, dj);
        });
        // TODO: merge ranges!
        this.set_filtered_ranges();
        this.set();
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

    set_filtered_ranges() {
        this.filtered_ranges = [];
        this.ranges.forEach(range => {
            this.filtered_ranges.push(new SelectionRange(this.sheet, range.start_i, range.start_j, range.end_i, range.end_j));
        });
        for (let i = 0; i < this.sheet.height; i++) {
            if (this.sheet.filtered_rows.has(i)) continue;
            let changed = true;
            while (changed) {
                changed = false;
                for (let k = 0; k < this.filtered_ranges.length; k++) {
                    if (!this.filtered_ranges[k].contains_row(i)) continue;
                    if (i > this.filtered_ranges[k].top) {
                        this.filtered_ranges.push(new SelectionRange(
                            this.sheet,
                            this.filtered_ranges[k].top,
                            this.filtered_ranges[k].start_j,
                            i - 1,
                            this.filtered_ranges[k].end_j
                        ));
                    }
                    if (i < this.filtered_ranges[k].bottom) {
                        this.filtered_ranges.push(new SelectionRange(
                            this.sheet,
                            i + 1,
                            this.filtered_ranges[k].start_j,
                            this.filtered_ranges[k].bottom,
                            this.filtered_ranges[k].end_j
                        ));
                    }
                    delete this.filtered_ranges[k];
                    this.filtered_ranges.splice(k, 1);
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

    format_html(value) {
        return this.format_text(value);
    }

    format_text(value) {
        return safe_format(value, x => x);
    }

    parse(string) {
        return safe_parse(string, x => x);
    }

}


class ColumnTypeText extends ColumnType {

    static ID = CTYPE_TEXT;
    static ALIGNEMENT = "aleft";
    static LABEL = "Text";

    format_html(value) {
        return safe_format(value, markdown_to_html);
    }

}


class ColumnTypeBoolean extends ColumnType {

    static ID = CTYPE_BOOLEAN;
    static ALIGNEMENT = "acenter";
    static LABEL = "Boolean";

    format_html(value) {
        return safe_format(value, x => x != "false" && x != "0" && x != "no" ? "✔️": "❌");
    }

}


class ColumnTypeInteger extends ColumnType {

    static ID = CTYPE_INTEGER;
    static ALIGNEMENT = "aright";
    static LABEL = "Integer";

    format_text(value) {
        return safe_format(value, x => x.toString());
    }

    parse(string) {
        return safe_parse(string, x => {
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

    format_text(value) {
        return safe_format(value, x => x.toString());
    }

    parse(string) {
        return safe_parse(string, x => {
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

    format_html(value) {
        return safe_format(value, x => x.toExponential(3));
    }

}


class ColumnTypePercentage extends ColumnTypeFloat {

    static ID = CTYPE_PERCENTAGE;
    static ALIGNEMENT = "aright";
    static LABEL = "Percentage";

    format_html(value) {
        return safe_format(value, x => (x * 100).toFixed(2) + " %");
    }

}


class ColumnTypeMonetary extends ColumnTypeFloat {

    static ID = CTYPE_MONETARY;
    static ALIGNEMENT = "aright";
    static LABEL = "Monetary";

    format_html(value) {
        return safe_format(value, x => x.toFixed(2) + " €");
    }

}


class ColumnTypeDatetime extends ColumnType {

    static ID = CTYPE_DATETIME;
    static ALIGNEMENT = "aleft";
    static LABEL = "Datetime";

    format_text(value) {
        return safe_format(value, x => x.toLocaleString());
    }

    parse(string) {
        return safe_parse(string, x => {
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

    format_text(value) {
        return safe_format(value, x => {
            return `${x.getFullYear()}-${(x.getMonth() + 1).toString().padStart(2, "0")}-${x.getDate().toString().padStart(2, "0")}`;
        });
    }

    parse(string) {
        return safe_parse(string, x => {
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

    format_text(value) {
        return safe_format(value, x => {
            return `${x.getHours().toString().padStart(2, "0")}:${x.getMinutes().toString().padStart(2, "0")}:${x.getSeconds().toString().padStart(2, "0")}`
        });
    }

    parse(string) {
        return safe_parse(string, x => {
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

    format_text(value) {
        return safe_format(value, x => {
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
        return safe_parse(string, x => {
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
        this.container = create(document.body, "div", ["context-menu"]);
        var self = this;
        window.addEventListener("click", () => {
            self.close();
        });
    }

    reset() {
        this.container.innerHTML = "";
        this.container.classList.remove("active");
    }

    add_item(label, callback) {
        let element = create(this.container, "div", ["context-menu-item"]);
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
        let wrapper = create(this.container, "div", ["context-menu-item", "context-submenu"]);
        let item = create(wrapper, "span", ["context-submenu-title"]);
        item.innerHTML = label;
        let menu = create(wrapper, "div", ["context-submenu-container"]);
        menu.add_item = (label, callback) => {
            let element = create(menu, "div", ["context-menu-item"]);
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
        this.container.querySelectorAll(".context-menu-item").forEach(item => {
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

    constructor(container) {
        // Config
        this.width = 4;
        this.height = 10;
        this.values = [];
        this.column_names = [];
        this.column_widths = [];
        this.column_types = [];
        this.row_heights = [];
        this.filters = [];
        this.highlights = {};

        // DOM
        this.container = container;
        this.cells = [];
        this.column_handles = [];
        this.row_handles = [];
        this.rows = [];
        this.column_heads = [];
        this.row_heads = [];
        
        // Flags
        this.selecting = false;
        this.selecting_rows = false;
        this.selecting_columns = false;
        this.editing = false;
        this.editing_column_name = false;
        this.resizing = false;
        
        // Attributes
        this.resizing_start = null;
        this.resizing_column = null;
        this.resizing_row = null;
        this.selection = new Selection(this);
        this.context_menu = new ContextMenu();
        this.filtered_rows = new Set();
        this.script = null;
        this.shrunk = false;
    }

    index_of_rows(row_name) {
        return parseInt(row_name) - 1;
    }

    index_of_columns(column_name) {
        return this.column_names.indexOf(column_name);
    }

    start_selection(i, j) {
        let root = this.selection.root();
        let was_root = i == root.i && j == root.j;
        if (this.editing && !was_root) {
            this.stop_editing();
        }
        this.selecting = true;
        this.selection.start(i, j, this.selecting_rows, this.selecting_columns);
        this.selection.set();
    }

    add_selection(i, j) {
        if (this.editing) this.stop_editing();
        this.selecting = true;
        this.selection.add(i, j, this.selecting_rows, this.selecting_columns);
        this.selection.set();
    }

    update_selection(i, j) {
        this.selection.update(this.selecting_columns ? this.height - 1 : i, this.selecting_rows ? this.width - 1 : j);
        this.selection.set();
    }

    end_selection() {
        this.selecting = false;
        this.selecting_rows = false;
        this.selecting_columns = false;
        this.selection.set();
    }

    get_selection_as_tsv() {
        if (this.selection == null) return "";      
        let bounds = this.selection.bounds();
        let array = [];
        for (let i = bounds.top; i <= bounds.bottom; i++) {
            if (!this.filtered_rows.has(i) || !this.selection.contains_row(i)) continue;
            array.push([]);
            let k = array.length - 1;
            for (let j = bounds.left; j <= bounds.right; j++) {
                if (!this.selection.contains_column(j)) continue;
                array[k].push(this.column_types[j].format_text(this.values[i][j]));
            }
        }  
        return format_tsv(array);
    }

    start_editing(caused_by_click=false) {
        this.editing = true;
        let root = this.selection.root();
        let cell = this.cells[root.i][root.j];
        let value = this.values[root.i][root.j];
        let input = create(cell, "textarea", ["sheet-cell-input"]);
        input.value = this.column_types[root.j].format_text(value);
        if (caused_by_click) {
            setTimeout(() => {
                input.focus();
            }, 1);
        } else {
            input.value = "";
            input.focus();
        }
    }

    start_editing_column_name(j) {
        var self = this;
        this.selection.reset();
        this.selection.clear();
        this.editing_column_name = true;
        let input = document.createElement("input");
        input.classList.add("sheet-column-name-input");
        input.value = this.column_names[j];
        input.placeholder = colname(j);
        function save_column_name() {
            self.set_column_name(j, input.value.trim());
        }
        function stop_editing_column_name() {
            save_column_name();
            self.editing_column_name = false;
            remove(input);
        }
        input.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        input.addEventListener("change", save_column_name);
        input.addEventListener("blur", stop_editing_column_name);
        input.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
                event.preventDefault();
                stop_editing_column_name();
            } else if (event.key == "Tab") {
                event.preventDefault();
                let target = null;
                if (event.shiftKey) {
                    target = j - 1;
                } else {
                    target = j + 1;
                }
                stop_editing_column_name();
                if (target >= 0 && target < self.width) {
                    self.start_editing_column_name(target);
                }
            }
        });
        this.column_heads[j].appendChild(input);
        input.focus();
        input.select();
    }

    set_cell_content(i, j) {
        this.cells[i][j].innerHTML = "";
        let key = `${i},${j}`;
        if (key in this.highlights) {
            let highlight = create(this.cells[i][j], "span", ["highlight"]);
            if (this.highlights[key] == HIGHLIGHT_ACCENT) {
                highlight.classList.add("highlight-accent");
            } else if (this.highlights[key] == HIGHLIGHT_SUCCESS) {
                highlight.classList.add("highlight-success");
            } else if (this.highlights[key] == HIGHLIGHT_ERROR) {
                highlight.classList.add("highlight-error");
            }
        }
        let wrapper = create(this.cells[i][j], "span", ["sheet-cell-content"]);
        if (this.values[i][j] == null) return;
        wrapper.innerHTML = this.column_types[j].format_html(this.values[i][j]);
    }

    stop_editing() {
        this.editing = false;
        let root = this.selection.root();
        let cell = this.cells[root.i][root.j];
        let input = cell.querySelector(".sheet-cell-input");
        if (input == null) {
            //console.warn("Tried to stop editing an empty cell:", cell);
            return;
        }
        let value = this.column_types[root.j].parse(input.value);
        this.values[root.i][root.j] = value;
        remove(input);
        this.set_cell_content(root.i, root.j);
        this.evaluate_script();
    }

    get_cursor_row(y) {
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

    get_cursor_column(x) {
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

    start_resizing_column(j, event) {
        this.resizing = true;
        this.resizing_column = j;
        this.resizing_start = event.clientX;
    }

    start_resizing_row(i, event) {
        this.resizing = true;
        this.resizing_row = i;
        this.resizing_start = event.clientY;
    }

    update_resizing_column(event) {
        let dx = event.clientX - this.resizing_start;
        let width = Math.max(MINIMUM_COLUMN_WIDTH, this.column_widths[this.resizing_column] + dx);
        this.set_column_width(this.resizing_column, width);
        this.resizing_start = event.clientX;
    }

    set_column_width(j, width) {
        this.column_widths[j] = width;
        this.column_heads[j].style.width = this.column_widths[j] + "px";
        let x = FIRST_COLUMN_WIDTH;
        for (let k = 0; k < this.width; k++) {
            x += this.column_widths[k] - 1;
            this.column_handles[k].style.left = (x - HANDLE_SIZE/2) + "px";
        }
    }

    set_row_height(i, height) {
        this.row_heights[i] = height;
        this.row_heads[i].style.height = this.row_heights[i] + "px";
        let y = 0;
        for (let k = 0; k < this.height; k++) {
            if (!this.row_handles[k].classList.contains("hidden")) {
                y += this.row_heights[k] - 1;
            }
            this.row_handles[k].style.top = (y - HANDLE_SIZE/2) + "px";
        }
    }

    update_resizing_row(event) {
        let dy = event.clientY - this.resizing_start;
        let height = Math.max(this.shrunk ? SHRUNK_ROW_HEIGHT : MINIMUM_ROW_HEIGHT, this.row_heights[this.resizing_row] + dy);
        this.set_row_height(this.resizing_row, height);
        this.resizing_start = event.clientY;
    }

    update_resizing(event) {
        if (this.resizing_column != null) {
            this.update_resizing_column(event);
        }
        if (this.resizing_row != null) {
            this.update_resizing_row(event);
        }
    }

    end_resizing() {
        this.resizing = false;
        this.resizing_start = null;
        this.resizing_row = null;
        this.resizing_column = null;
    }

    auto_resize_column(j) {
        let max_width = MINIMUM_COLUMN_WIDTH;
        for (let i = 0; i < this.height; i++) {
            let wrapper = this.cells[i][j].querySelector(".sheet-cell-content");
            if (wrapper == null) continue;
            let width = wrapper.getBoundingClientRect().width;
            max_width = Math.max(max_width, width);
        }
        this.set_column_width(j, max_width);
    }

    auto_resize_row(i) {
        let max_height = this.shrunk ? SHRUNK_ROW_HEIGHT : MINIMUM_ROW_HEIGHT;
        for (let j = 0; j < this.width; j++) {
            let wrapper = this.cells[i][j].querySelector(".sheet-cell-content");
            if (wrapper == null) continue;
            let height = wrapper.getBoundingClientRect().height;
            max_height = Math.max(max_height, height);
        }
        this.set_row_height(i, max_height);
    }

    insert_column(j) {
        if (this.editing) this.stop_editing();
        for (let k = j; k < this.width; k++) {
            if (this.column_names[k] == colname(k)) {
                this.column_names[k] = colname(k + 1);
            }
        }
        this.width++;
        this.column_names.splice(j, 0, colname(j));
        this.column_widths.splice(j, 0, DEFAULT_COLUMN_WIDTH);
        this.column_types.splice(j, 0, new COLUMN_TYPES[CTYPE_TEXT]());
        this.filters.splice(j, 0, new Set());
        for (let i = 0; i < this.height; i++) {
            this.values[i].splice(j, 0, null);
        }
        this.inflate();
    }

    delete_column(j) {
        if (this.editing) this.stop_editing();
        this.selection.clear();
        this.selection.reset();
        for (let k = j+1; k < this.width; k++) {
            if (this.column_names[k] == colname(k)) {
                this.column_names[k] = colname(k - 1);
            }
        }
        this.width--;
        this.column_names.splice(j, 1);
        this.column_widths.splice(j, 1);
        this.column_types.splice(j, 1);
        this.filters.splice(j, 1);
        for (let i = 0; i < this.height; i++) {
            this.values[i].splice(j, 1);
        }
        this.inflate();
    }

    insert_row(i) {
        if (this.editing) this.stop_editing();
        this.height++;
        this.row_heights.splice(i, 0, this.shrunk ? SHRUNK_ROW_HEIGHT : DEFAULT_ROW_HEIGHT);
        let row = [];
        for (let j = 0; j < this.width; j++) {
            row.push(null);
        }
        this.values.splice(i, 0, row);
        this.inflate();
    }

    delete_row(i) {
        if (this.editing) this.stop_editing();
        this.selection.clear();
        this.selection.reset();
        this.height--;
        this.row_heights.splice(i, 1);
        this.values.splice(i, 1);
        this.inflate();
    }

    toggle_filter(j, value) {
        if (this.filters[j].has(value)) {
            this.filters[j].delete(value);
            return false;
        } else {
            this.filters[j].add(value);
            return true;
        }
    }

    open_column_context_menu(x, y, j) {
        this.context_menu.reset();
        var self = this;
        let type_menu = this.context_menu.add_menu("Type");
        COLUMN_TYPES.forEach(ctype => {
            let el = type_menu.add_item(ctype.LABEL, () => {
                self.set_column_type(j, ctype.ID);
                type_menu.querySelectorAll(".selected").forEach(e => {
                    e.classList.remove("selected");
                });
                el.classList.add("selected");
            });
            if (ctype.ID == this.column_types[j].constructor.ID) {
                el.classList.add("selected");
            }
        });
        let filter_menu = this.context_menu.add_menu("Filter");
        let values = Array.from(this.get_value_set(j));
        values.splice(0, 0, null);
        values.forEach(value => {
            let el = filter_menu.add_item(`<input type="checkbox" ${this.filters[j].has(value) ? "" : "checked"} /> ${value == null ? "(Empty)" : value}`, () => {
                el.querySelector("input").checked = !self.toggle_filter(j, value);
                self.update_filters();
            });
        });
        this.context_menu.add_item("Insert left", () => {
            let bounds = self.selection.bounds();
            self.insert_column(bounds.left);
            self.selection.move(0, 1, true);
        });
        this.context_menu.add_item("Insert right", () => {
            let bounds = self.selection.bounds();
            self.insert_column(bounds.right + 1);
        });
        this.context_menu.add_item("Delete", () => {
            let columns_to_delete = self.selection.columns();
            columns_to_delete.reverse();
            columns_to_delete.forEach(k => self.delete_column(k));
        });
        this.context_menu.add_item("Copy values", () => {
            let strings = [];
            self.get_value_set(j).forEach(value => {
                strings.push(self.column_types[j].format_text(value));
            });
            navigator.clipboard.writeText(strings.join("\n"));
        });
        this.context_menu.open(x, y);
    }

    open_row_context_menu(x, y, i) {
        this.context_menu.reset();
        var self = this;
        this.context_menu.add_item("Insert top", () => {
            let bounds = self.selection.bounds();
            self.insert_row(bounds.top);
            self.selection.move(1, 0, true);
        });
        this.context_menu.add_item("Insert bottom", () => {
            let bounds = self.selection.bounds();
            self.insert_row(bounds.bottom + 1);
        });
        this.context_menu.add_item("Delete", () => {
            let rows_to_delete = self.selection.rows();
            rows_to_delete.reverse();
            rows_to_delete.forEach(k => self.delete_row(k));
        } );
        this.context_menu.open(x, y);
    }

    set_column_type(j, ctype) {
        let old_ctype = this.column_types[j];
        let new_ctype = new (COLUMN_TYPES[ctype])();
        this.column_types[j] = new_ctype;
        for (let i = 0; i < this.height; i++) {
            this.cells[i][j].classList.remove(old_ctype.constructor.ALIGNEMENT);
            this.cells[i][j].classList.add(new_ctype.constructor.ALIGNEMENT);
            if (this.values[i][j] == null) continue;
            this.values[i][j] = new_ctype.parse(old_ctype.format_text(this.values[i][j]));
            this.set_cell_content(i, j);
        }
        this.evaluate_script();
    }

    set_column_name(j, name) {
        this.column_names[j] = name.trim() == "" ? colname(j) : name.trim();
        this.column_heads[j].querySelector(".sheet-column-name").textContent = this.column_names[j];
    }

    sort_rows(j, ascending) {
        //TODO: use ctype comparator?
        let order = [];
        var self = this;
        for (let i = 0; i < this.height; i++) {
            order.push(i);
        }
        let comparator = (p, q) => {
            let a = self.values[p][j];
            let b = self.values[q][j];
            if (a == null && b == null) return 0;
            if (a == null) return -1;
            if (b == null) return 1;
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        }
        order.sort(comparator);
        if (!ascending) order.reverse();
        this.values = tidy(this.values, order);
        this.row_heights = tidy(this.row_heights, order);
        this.inflate();
        this.container.querySelectorAll(`.sheet-column-sort`).forEach(element => {
            element.classList.remove("ascending");
            element.classList.remove("descending");
        });
        this.column_heads[j].querySelector(".sheet-column-sort").classList.add(ascending ? "ascending" : "descending");
    }

    update_filters() {
        this.filtered_rows = new Set();
        let y = 0;
        let row_top = 0;
        for (let i = 0; i < this.height; i++) {
            let should_be_displayed = true;
            for (let j = 0; j < this.width; j++) {
                if (this.filters[j].has(this.values[i][j])) {
                    should_be_displayed = false;
                    break;
                }
            }
            if (should_be_displayed) {
                this.filtered_rows.add(i);
                y += this.row_heights[i] - 1;
                this.rows[i].classList.remove("hidden");
                this.row_handles[i].classList.remove("hidden");
                this.row_handles[i].style.top = (y - HANDLE_SIZE/2) + "px";
                for (let j = 0; j < this.width; j++) {
                    this.cells[i][j].style.top = row_top + "px";
                    this.row_heads[i].style.top = row_top + "px";
                }
                row_top--;
            } else {
                this.rows[i].classList.add("hidden");
                this.row_handles[i].classList.add("hidden");
            }
        }
        this.selection.set_filtered_ranges();
        this.selection.set();
    }

    set_cells_event_listeners() {
        var self = this;
        for (let i = 0; i < this.height; i++) {
            for (let j = 0; j < this.width; j++) {
                this.cells[i][j].addEventListener("mousedown", (event) => {
                    let in_selection = self.selection.contains(i, j);
                    if (event.ctrlKey && !in_selection) {
                        self.add_selection(i, j);
                    } else if (event.shiftKey  && !in_selection) {
                        self.update_selection(i, j);
                    } else if (!event.ctrlKey && !event.shiftKey) {
                        self.start_selection(i, j);
                    }
                });
                this.cells[i][j].addEventListener("dblclick", () => {
                    if (!self.editing) self.start_editing(true);
                });
                this.cells[i][j].addEventListener("mousemove", () => {
                    if (self.selecting) {
                        self.update_selection(i, j);
                    }
                });
            }
        }
        for (let j = 0; j < this.width; j++) {
            let handle = this.column_handles[j];
            handle.addEventListener("mousedown", (event) => {
                self.start_resizing_column(j, event);
            });
            handle.addEventListener("dblclick", () => {
                self.auto_resize_column(j);
            });
        }
        for (let i = 0; i < this.height; i++) {
            let handle = this.row_handles[i];
            handle.addEventListener("mousedown", (event) => {
                self.start_resizing_row(i, event);
            });
            handle.addEventListener("dblclick", () => {
                self.auto_resize_row(i);
            });
        }
        for (let i = 0; i < this.height; i++) {
            this.row_heads[i].addEventListener("mousedown", (event) => {
                if (event.button == 0) {
                    self.selecting_rows = true;
                    self.start_selection(i, 0);
                }
            });
            this.row_heads[i].addEventListener("contextmenu", (event) => {
                event.preventDefault();
                if (!self.selection.contains_row(i)) {
                    self.selecting_rows = true;
                    self.start_selection(i, 0);
                    self.end_selection();
                }
                self.open_row_context_menu(event.clientX, event.clientY, i);
            });
            this.row_heads[i].addEventListener("mousemove", () => {
                if (self.selecting) {
                    self.update_selection(i, 0);
                }
            });
        }
        let cell_top_left = this.container.querySelector(".sheet-row-head .sheet-cell:first-child");
        cell_top_left.addEventListener("click", () => {
            document.querySelector(".script-window").classList.remove("hidden");
            document.querySelector(".script-textarea").focus();
        });
        for (let j = 0; j < this.width; j++) {
            this.column_heads[j].addEventListener("mousedown", (event) => {
                if (event.button == 0) {
                    self.selecting_columns = true;
                    self.start_selection(0, j);
                }
            });
            this.column_heads[j].addEventListener("contextmenu", (event) => {
                event.preventDefault();
                if (!self.selection.contains_column(j)) {
                    self.selecting_columns = true;
                    self.start_selection(0, j);
                    self.end_selection();
                }
                self.open_column_context_menu(event.clientX, event.clientY, j);
            });
            this.column_heads[j].addEventListener("mousemove", () => {
                if (self.selecting) {
                    self.update_selection(0, j);
                }
            });
            let cell_sort = this.column_heads[j].querySelector(".sheet-column-sort");
            cell_sort.addEventListener("click", (event) => {
                self.sort_rows(j, !cell_sort.classList.contains("ascending"));
            });
            let cell_name = this.column_heads[j].querySelector(".sheet-column-name");
            cell_name.addEventListener("dblclick", (event) => {
                self.start_editing_column_name(j);
            });
        }
    }

    toggle_marker(marker) {
        let enabled = null;
        let regex_left = new RegExp(`^${marker.replaceAll("*", "\\*")}`);
        let regex_right = new RegExp(`${marker.replaceAll("*", "\\*")}$`);
        this.selection.iterate((i, j) => {
            if (this.column_types[j].constructor.ID == CTYPE_TEXT) {
                if (enabled == null) {
                    enabled = this.values[i][j].startsWith(marker) && this.values[i][j].endsWith(marker);
                }
                if (enabled) {
                    this.values[i][j] = this.values[i][j].replace(regex_left, "").replace(regex_right, "")
                } else {
                    this.values[i][j] = marker + this.values[i][j] + marker;
                }
                this.set_cell_content(i, j);
            }
        });
        this.evaluate_script();
    }

    toggle_bold() {
        this.toggle_marker("**");
    }

    toggle_italic() {
        this.toggle_marker("*");
    }

    set_global_event_listeners() {
        var self = this;
        this.container.addEventListener("paste", (event) => {
            if (self.selection != null) {
                event.preventDefault();
                let string = event.clipboardData.getData("text");
                let array = parse_tsv(string);
                let root = self.selection.root();
                if (array.length == 1 && array[0].length == 1) {
                    self.selection.iterate((i, j) => {
                        self.values[i][j] = self.column_types[j].parse(array[0][0]);
                        self.set_cell_content(i, j);
                    });
                } else {
                    self.selection.reset();
                    self.selection.start(root.i, root.j);
                    self.selection.update(
                        Math.min(self.height - 1, root.i + array.length - 1),
                        Math.min(self.width - 1, root.j + array[0].length - 1)
                    )
                    self.selection.iterate((i, j) => {
                        self.values[i][j] = self.column_types[j].parse(array[i - root.i][j - root.j]);
                        self.set_cell_content(i, j);
                    });
                }
                self.evaluate_script();
            }
        });
        document.addEventListener("mousemove", (event) => {
            if (self.resizing) {
                self.update_resizing(event);
            }
        });
        document.addEventListener("mouseup", () => {
            if (self.selecting) {
                self.end_selection();
            }
            if (self.resizing) {
                self.end_resizing();
            }
        });
        document.addEventListener("keydown", (event) => {
            if (self.editing_column_name) {
                return;
            }
            if (event.key == "a" && event.ctrlKey) {
                self.selection.all();
                return;
            }
            if (self.selection != null) {
                if (event.key == "Enter") {
                    if (event.altKey && self.editing) {
                        let root = self.selection.root();
                        let textarea = self.cells[root.i][root.j].querySelector(".sheet-cell-input");
                        textarea.value += "\n";
                        textarea.scrollTop = textarea.scrollHeight;
                    } else {
                        if (self.editing) self.stop_editing();
                        self.selection.move(1, 0);
                    }
                } else if (event.key == "ArrowUp") {
                    if (self.editing) self.stop_editing();
                    if (event.shiftKey) {
                        self.selection.expand(-1, 0);
                    } else {
                        self.selection.move(-1, 0, event.ctrlKey);
                    }
                } else if (event.key == "ArrowDown") {
                    if (self.editing) self.stop_editing();
                    if (event.shiftKey) {
                        self.selection.expand(1, 0);
                    } else {
                        self.selection.move(1, 0, event.ctrlKey);
                    }
                } else if (event.key == "ArrowLeft") {
                    if (self.editing) self.stop_editing();
                    if (event.shiftKey) {
                        self.selection.expand(0, -1);
                    } else {
                        self.selection.move(0, -1, event.ctrlKey);
                    }
                } else if (event.key == "ArrowRight") {
                    if (self.editing) self.stop_editing();
                    if (event.shiftKey) {
                        self.selection.expand(0, 1);
                    } else {
                        self.selection.move(0, 1, event.ctrlKey);
                    }
                } else if (!self.editing && (event.key == "Delete" || event.key == "Backspace")) {
                    self.selection.iterate((i, j) => {
                        self.values[i][j] = null;
                        self.set_cell_content(i, j);
                    });
                    self.evaluate_script();
                } else if (event.key == "Tab") {
                    if (self.editing) self.stop_editing();
                    if (event.shiftKey) {
                        self.selection.move(0, -1);
                    } else {
                        self.selection.move(0, 1);
                    }
                    event.preventDefault();
                } else if (event.key == "b" && event.ctrlKey) {
                    event.preventDefault();
                    self.toggle_bold();
                } else if (event.key == "i" && event.ctrlKey) {
                    event.preventDefault();
                    self.toggle_italic();
                } else if (event.key == "k" && event.ctrlKey) {
                    let root = this.selection.root();
                    let value = this.values[root.i][root.j];
                    if (value != null && typeof(value) == typeof("")) {
                        if (value.match(MARKDOWN_PATTERN_LINK)) {
                            let match = MARKDOWN_PATTERN_LINK.exec(value);
                            let url = prompt("Current URL:", match[2]);
                            if (url == null) {
                                this.values[root.i][root.j] = match[1];
                            } else {
                                this.values[root.i][root.j] = `[${match[1]}](${url})`;
                            }
                            this.set_cell_content(root.i, root.j);
                        } else {
                            let url = prompt("Enter a URL:");
                            if (url != null) {
                                this.values[root.i][root.j] = `[${value}](${url})`;
                                this.set_cell_content(root.i, root.j);
                            }
                        }
                    }
                } else if (event.key == "c" && event.ctrlKey) {
                    event.preventDefault();
                    let string = self.get_selection_as_tsv();
                    navigator.clipboard.writeText(string);
                } else if (event.altKey && (event.key == "²" || event.key == "&" || event.key == "é" || event.key == "\"")) {
                    if (event.key == "²") {
                        self.selection.iterate((i, j) => {
                            let key = `${i},${j}`;
                            if (key in self.highlights) {
                                delete self.highlights[key];
                                self.set_cell_content(i, j);
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
                            self.set_cell_content(i, j);
                        });
                    }
                    
                    
                } else if (!self.editing && event.key.length == 1) {
                    // console.log(event.key);
                    self.start_editing();
                }
            }
        });
    }

    get_value_set(j) {
        let vset = new Set();
        for (let i = 0; i < this.height; i++) {
            if (this.values[i][j] == null) continue;
            vset.add(this.values[i][j]);
        }
        return Array.from(vset);
    }

    toggle_shrink() {
        this.shrunk = !this.shrunk;
        for (let i = 0; i < this.height; i++) {
            if (this.shrunk && this.row_heights[i] == DEFAULT_ROW_HEIGHT) {
                this.row_heights[i] = SHRUNK_ROW_HEIGHT;
            } else if (!this.shrunk && this.row_heights[i] == SHRUNK_ROW_HEIGHT) {
                this.row_heights[i] = DEFAULT_ROW_HEIGHT;
            }
        }
        this.inflate();
    }

    inflate() {
        this.container.innerHTML = "";
        this.container.classList.add("sheet");
        if (this.shrunk) {
            this.container.classList.add("sheet-shrink");
        } else {
            this.container.classList.remove("sheet-shrink");
        }
        let table = create(this.container, "table", ["sheet-table"]);
        let table_head = create(table, "thead");
        let table_body = create(table, "tbody");
        
        let row_head = create(table_head, "tr", ["sheet-row", "sheet-row-head"]);
        let cell_top_left = create(row_head, "th", ["sheet-cell", "sheet-cell-head", "sheet-cell-top-left"]);
        cell_top_left.style.height = (this.shrunk ? SHRUNK_ROW_HEIGHT : DEFAULT_ROW_HEIGHT) + "px";
        cell_top_left.textContent = "ℱ"; //ƒ
        this.column_heads = [];
        for (let j = 0; j < this.width; j++) {
            this.column_heads.push(create(row_head, "th", ["sheet-cell"]));
            this.column_heads[j].style.width = this.column_widths[j] + "px";
            this.column_heads[j].style.left = `-${j}px`;
            let shelf = create(this.column_heads[j], "div", ["sheet-cell-shelf"]);
            let cell_sort = create(shelf, "span", ["sheet-cell-shelf-item", "sheet-column-sort"]);
            cell_sort.title = "Sort";
            let cell_name = create(shelf, "span", ["sheet-cell-shelf-item", "sheet-column-name"]);
            cell_name.textContent = this.column_names[j];
        }

        let x = FIRST_COLUMN_WIDTH;
        this.column_handles = [];
        for (let j = 0; j < this.width; j++) {
            this.column_handles.push(create(row_head, "div", ["handle", "handle-column"]));
            x += this.column_widths[j] - 1;
            this.column_handles[j].style.left = (x - HANDLE_SIZE/2) + "px";
        }

        this.cells = [];
        this.rows = [];
        this.row_heads = [];
        for (let i = 0; i < this.height; i++) {
            this.rows.push(create(table_body, "tr", ["sheet-row"]));
            this.row_heads.push(create(this.rows[i], "td", ["sheet-cell", "sheet-cell-head"]));
            this.row_heads[i].textContent = rowname(i);
            this.row_heads[i].style.height = this.row_heights[i] + "px";
            this.row_heads[i].style.top = `-${i}px`;
            this.cells.push([]);
            for (let j = 0; j < this.width; j++) {
                this.cells[i].push(create(this.rows[i], "td", ["sheet-cell", this.column_types[j].constructor.ALIGNEMENT]));
                this.cells[i][j].style.top = `-${i}px`;
                this.cells[i][j].style.left = `-${j}px`;
                this.set_cell_content(i, j);
            }
        }

        let y = 0;
        this.row_handles = [];
        for (let i = 0; i < this.height; i++) {
            this.row_handles.push(create(table_body, "div", ["handle", "handle-row"]));
            this.row_handles[i].setAttribute("i", i);
            y += this.row_heights[i] - 1;
            this.row_handles[i].style.top = (y - HANDLE_SIZE/2) + "px";
        }

        this.update_filters();

        this.set_cells_event_listeners();
    }

    initialize_values(data_container, config_container) {
        let data = null;
        if (data_container != null) {
            data = parse_tsv(data_container.innerHTML);
            this.height = data.length - 1;
            this.width = data[0].length;
        }
        let config = null;
        if (config_container != null) {
            config = JSON.parse(config_container.innerHTML);
            this.highlights = config.highlights;
        }
        this.column_types = [];
        this.column_widths = [];
        for (let j = 0; j < this.width; j++) {
            if (config == null) {
                this.column_widths.push(DEFAULT_COLUMN_WIDTH);
                this.column_types.push(new COLUMN_TYPES[CTYPE_TEXT]());
            } else {
                this.column_widths.push(config.column_widths[j]);
                this.column_types.push(new COLUMN_TYPES[config.column_types[j]]());
            }
            if (data == null) {
                this.column_names.push(colname(j));
            } else {
                this.column_names.push(data[0][j]);
            }
            this.filters.push(new Set());
        }
        this.row_heights = [];
        for (let i = 0; i < this.height; i++) {
            if (config == null) {
                this.row_heights.push(DEFAULT_ROW_HEIGHT);
            } else {
                this.row_heights.push(config.row_heights[i]);
            }
        }
        this.values = [];
        for (let i = 0; i < this.height; i++) {
            this.values.push([]);
            for (let j = 0; j < this.width; j++) {
                if (data == null) {
                    this.values[i].push(null);
                } else {
                    this.values[i].push(this.column_types[j].parse(data[i + 1][j]));
                }
            }
        }
        if (config != null) {
            this.script = Script.from_string(config.script);
            this.filters = [];
            config.filters.forEach(array => {
                this.filters.push(new Set(array));
            });
        }
    }

    update_script(script_string) {
        if (this.script != null) delete this.script;
        this.script = Script.from_string(script_string);
        this.evaluate_script();
    }

    evaluate_script() {
        if (this.script == null) return;
        this.script.evaluate(this);
    }

    inflate_script_window() {
        var self = this;
        let script_window = create(document.body, "div", ["script-window", "hidden"]);
        let script_overlay = create(script_window, "span", ["script-overlay"]);
        script_overlay.addEventListener("click", () => {
            script_window.classList.add("hidden");
        });
        let script_container = create(script_window, "div", ["script-container"]);
        let script_buttons = create(script_container, "div", ["mb-2"]);
        let script_save_button = create(script_buttons, "button", ["btn", "btn-primary", "mr-1"]);
        script_save_button.textContent = "Save";
        script_save_button.addEventListener("click", () => {
            script_window.classList.add("hidden");
        });
        let script_compute_button = create(script_buttons, "button", ["btn"]);
        script_compute_button.textContent = "Compute";
        script_compute_button.title = "Force re-computing everything";
        script_compute_button.addEventListener("click", () => {
            self.evaluate_script();
            script_window.classList.add("hidden");
        });
        let script_textarea = create(script_container, "textarea", ["script-textarea"]);
        if (this.script != null) {
            script_textarea.value = this.script.string;
        }
        script_textarea.addEventListener("keydown", (event) => {
            event.stopPropagation();
        });
        script_textarea.addEventListener("change", (event) => {
            self.update_script(script_textarea.value);
        });
    }

    setup(data_container, style_container) {
        this.context_menu.setup();
        this.initialize_values(data_container, style_container);
        this.inflate();
        this.inflate_script_window();
        this.set_global_event_listeners();
        this.evaluate_script();
    }

}


function initialize_sheet(container, data_container, config_container) {
    let sheet = new Sheet(container);
    sheet.setup(data_container, config_container);
}