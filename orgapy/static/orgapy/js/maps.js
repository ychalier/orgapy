const PROVIDERS = [
    {
        label: "OpenStreetMap",
        tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        options: {
            maxZoom: 19,
            attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`,
        }
    },
    {
        label: "OpenTopoMap",
        tiles: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        options: {
            maxZoom: 17,
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        }
    },
    {
        label: "Esri World Imagery",
        tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        options: {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }
    },
]


function create(parent=null, tag="div", classes=null) {
    let element = document.createElement(tag);
    if (parent != null) parent.appendChild(element);
    if (classes != null) {
        classes.forEach(cls => {
            element.classList.add(cls);
        });
    }
    return element;
}


function remove(element) {
    element.parentNode.removeChild(element);
}


function setdefault(object, attrname, value) {
    if (object[attrname] == undefined) {
        object[attrname] = value;
    }
}


function stop_propagation(event) {
    event.stopPropagation();
    return false;
}


function reverse_latlng(coordinates) {
    if (coordinates.length == 2 && typeof(coordinates[0]) == "number") {
        return [coordinates[1], coordinates[0]];
    }
    let output = [];
    coordinates.forEach(part => {
        output.push(reverse_latlng(part));
    });
    return output;
}


function hex_to_hsl(hex) {
    // https://stackoverflow.com/questions/46432335
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if(max == min) {
        h = s = 0;
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    s = s*100;
    s = Math.round(s);
    l = l*100;
    l = Math.round(l);
    h = Math.round(360 * h);
    return [h, s, l];
}


function hsl_to_hex(h, s, l) {
    // https://stackoverflow.com/questions/36721830/
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');   // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}


function get_opposite_color(color) {
    if (color == null || color == undefined) return DEFAULT_STROKE_COLOR;
    let hsl = hex_to_hsl(color);
    return hsl_to_hex((hsl[0] + 180) % 360, hsl[1], hsl[2]);
}


function get_hue_rotation(color, base_color="#2981ca") {
    return hex_to_hsl(color)[0] - hex_to_hsl(base_color)[0];
}


class CurrentPositionControl extends L.Control {

    constructor() {
        super({position: "bottomleft"});
    }

    onAdd(map) {
        let container = create();
        let label = create(container, "span");
        label.style.cursor = "pointer";
        label.style.color = "black";
        label.title = "Click to copy";
        function set_label_text(event) {
            let point = event ? event.latlng : map.getCenter();
            label.textContent = `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
        }
        label.addEventListener("click", (event) => {
            event.stopPropagation();
            set_label_text();
            navigator.clipboard.writeText(label.textContent);
        });
        set_label_text();
        map.addEventListener("mousemove", set_label_text);
        return container;
    }

}


class PanelControl extends L.Control {

    constructor(map) {
        super({position: "topleft"});
        this.map = map;
        this.map_title = null;
        this.panel_container = null;
        this.layers_container = null;
    }

    inflate_map_title() {
        var self = this;
        if (this.map_title == null) {
            this.map_title = create(this.panel_container, "div", ["map-title"]);
        } else {
            let foo = create(null, "div", ["map-title"]);
            this.map_title.replaceWith(foo);
            this.map_title = foo;
        }
        this.map_title.textContent = this.map.title;
        this.map_title.addEventListener("click", () => {
            self.inflate_map_title_edit();
        });
    }

    inflate_map_title_edit() {
        var self = this;
        let form = create(null, "form");
        let input = create(form, "input", ["form-input", "mb-2"]);
        input.value = this.map.title;
        this.map_title.replaceWith(form);
        this.map_title = form;
        input.focus();
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let new_title = input.value.trim();
            if (new_title != "") {
                self.map.set_title(new_title);
                self.inflate_map_title();
            }
        });
    }

    inflate_base_map_form() {
        var self = this;
        let wrapper = create(this.panel_container, "div", ["basemap-form"]);
        let label = create(wrapper, "label");
        label.textContent = "Base map";
        label.setAttribute("for", "select-base-map");
        let select = create(this.panel_container, "select", ["form-select"]);
        select.setAttribute("id", "select-base-map");
        PROVIDERS.forEach((provider, i) => {
            let option = create(select, "option");
            option.value = i;
            option.textContent = provider.label;
        });
        select.addEventListener("input", () => {
            let provider_index = null;
            select.querySelectorAll("option").forEach(option => {
                if (option.selected) provider_index = parseInt(option.value);
            });
            self.map.set_tile_layer(provider_index);
        });
    }

    inflate_panel() {
        var self = this;
        this.inflate_map_title();
        if (!this.map.readonly) {
            let buttons = create(this.panel_container, "div", ["mb-2"]);
            this.map.button_save = create(buttons, "button", ["btn", "btn-sm", "mr-1"]);
            this.map.button_save.textContent = "Save";
            this.map.button_save.setAttribute("disabled", true);
            this.map.button_save.addEventListener("click", (event) => {
                event.stopPropagation();
                self.map.save_data();
            });
            let button_add_layer = create(buttons, "span", ["btn", "btn-sm"]);
            button_add_layer.innerHTML = `<i class="icon icon-plus mr-1"></i><span class="button-label">Layer</span>`;
            button_add_layer.title = "Add layer";
            button_add_layer.addEventListener("click", () => {
                self.map.add_layer();
            });
        }
        this.layers_container = create(this.panel_container, "div", ["map-layers"]);
        this.layers_container.addEventListener("wheel", (event) => {
            event.stopPropagation();
        });
        if (!this.map.readonly) {
            this.inflate_base_map_form();
        }
    }

    onAdd(map) {
        let container = create(null, "div", ["map-control"]);
        this.panel_container = create(container, "div", ["map-panel"]);
        this.inflate_panel();
        return container;
    }

}


class SearchControl extends L.Control {

    constructor(map) {
        super({position: "topright"});
        this.map = map;
        this.searchbar_container = null;
    }

    search_nominatim(query) {
        var self = this;
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURI(query)}&format=jsonv2`;
        fetch(url).then(res => res.json()).then(results => {
            if (results.length == 0) {
                alert("No result found!");
                return;
            }
            //TODO?: handle choice between multiple results
            let best_result = results[0];
            self.onresult({
                lat: best_result.lat,
                lon: best_result.lon,
                label: best_result.display_name
            });
        });
    }

    onresult(result) {
        let marker = new L.marker([parseFloat(result.lat), parseFloat(result.lon)]);
        this.map.get_selected_layer().add_feature_from_map_element(marker, {label: result.label});
        this.map.leaflet_map.panTo(marker.getLatLng());
    }

    search(query) {
        if (query.match(/^\d+(\.\d+)? *, *\d+(\.\d+)?$/g)) {
            this.onresult({
                lat: parseFloat(query.split(",")[0]),
                lon: parseFloat(query.split(",")[1]),
                label: "GPS Point"
            });
        } else {
            this.search_nominatim(query);
        }
    }

    inflate() {
        let form = create(this.searchbar_container, "form", ["inline-form"]);
        let input = create(form, "input", ["form-input"]);
        input.type = "text";
        input.placeholder = "Search";
        let button = create(form, "span", ["btn"]);
        button.innerHTML = `<i class="icon icon-search"></i>`;
        button.style.width = "38px";
        button.title = "Search";
        button.addEventListener("click", () => {
            form.submit();
        });
        var self = this;
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let query = input.value.trim();
            if (query != "") {
                self.search(query);
            }
        });
    }

    onAdd(map) {
        let container = create(null, "div", ["map-control"]);
        this.searchbar_container = create(container, "div", ["map-searchbar"]);
        this.inflate();
        return container;
    }

}


class ToolbarControl extends L.Control {

    constructor(map) {
        super({position: "topright"});
        this.map = map;
        this.toolbar_container = null;
    }

    inflate() {
        var self = this;
        let button_home = create(this.toolbar_container, "span", ["btn", "btn-action", "mb-1"]);
        button_home.innerHTML = `<i class="icon icon-home"></i>`;
        button_home.title = "Reset view";
        button_home.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.fit_view_to_features();
        });
        let button_marker = create(this.toolbar_container, "span", ["btn", "btn-action", "mb-1"]);
        button_marker.innerHTML = `<i class="icon icon-marker"></i>`;
        button_marker.title = "Add marker";
        button_marker.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.start_marker();
        });
        let button_polyline = create(this.toolbar_container, "span", ["btn", "btn-action", "mb-1"]);
        button_polyline.innerHTML = `<i class="icon icon-polyline"></i>`;
        button_polyline.title = "Add polyline";
        button_polyline.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.start_polyline();
        });
        let button_polygon = create(this.toolbar_container, "span", ["btn", "btn-action", "mb-1"]);
        button_polygon.innerHTML = `<i class="icon icon-polygon"></i>`;
        button_polygon.title = "Add polygon";
        button_polygon.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.start_polygon();
        });
        let button_toggle_edition = create(this.toolbar_container, "span", ["btn", "btn-action"]);
        button_toggle_edition.innerHTML = `<i class="icon icon-edit"></i>`;
        button_toggle_edition.title = "Toggle edition";
        button_toggle_edition.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.toggle_edition();
            if (self.map.editing) {
                button_toggle_edition.querySelector("i").className = "icon icon-cross";
            } else {
                button_toggle_edition.querySelector("i").className = "icon icon-edit";
            }
        });
    }

    onAdd(map) {
        let container = create(null, "div", ["map-control"]);
        this.toolbar_container = create(container, "div", ["map-toolbar"]);
        this.inflate();
        return container;
    }

}


const RESERVERD_PROPERTIES = new Set(["label", "strokeColor", "strokeWidth", "fillColor", "fillOpacity"]);
const DEFAULT_STROKE_COLOR = "#0080ff";
const DEFAULT_STROKE_WIDTH = "3.0";
const DEFAULT_FILL_COLOR = "#0080ff";
const DEFAULT_FILL_OPACITY = "0.25";


class Feature {

    constructor(layer, index, geojson_data) {
        this.layer = layer;
        this.index = index;
        this.geometry = {};
        this.geometry.type = geojson_data.geometry.type;
        // NOTE: coordinates are stored using the GeoJson order,
        // ie. longitude first, then latitude.
        // Leafleft uses the reversed, order.
        // To switch, @see `reverse_latlng`
        this.geometry.coordinates = geojson_data.geometry.coordinates;
        this.properties = geojson_data.properties;
        setdefault(this.properties, "label", this.layer.find_default_label());
        setdefault(this.properties, "strokeColor", DEFAULT_STROKE_COLOR);
        setdefault(this.properties, "strokeWidth", DEFAULT_STROKE_WIDTH);
        setdefault(this.properties, "fillColor", DEFAULT_FILL_COLOR);
        setdefault(this.properties, "fillOpacity", DEFAULT_FILL_OPACITY);
        this.map_element = null;
        this.panel_element = null;
    }

    to_geojson() {
        return {
            type: "Feature",
            geometry: {
                type: this.geometry.type,
                coordinates: this.geometry.coordinates
            },
            properties: this.properties,
        }
    }

    set_style(custom_style=null) {
        if (this.map_element == null) return;
        let style = custom_style == null ? this.properties : custom_style;
        switch(this.geometry.type) {
            case "Point":
                this.map_element._icon.style.filter = `hue-rotate(${get_hue_rotation(style.fillColor)}deg)`;
                break;
            case "LineString":
                this.map_element.setStyle({
                    color: style.strokeColor,
                    weight: style.strokeWidth,
                });
                break;
            case "Polygon":
                this.map_element.setStyle({
                    color: style.strokeColor,
                    weight: style.strokeWidth,
                    fillColor: style.fillColor,
                    fillOpacity: style.fillOpacity,
                });
                break;
            case "MultiPoint":
                this.map_element.getLayers().forEach(marker => {
                    marker._icon.style.filter = `hue-rotate(${get_hue_rotation(style.fillColor)}deg)`;
                });
                break;
            case "MultiLineString":
                this.map_element.getLayers().forEach(polyline => {
                    polyline.setStyle({
                        color: style.strokeColor,
                        weight: style.strokeWidth,
                    });
                });
                break;
            case "MultiPolygon":
                this.map_element.getLayers().forEach(polygon => {
                    polygon.setStyle({
                        color: style.strokeColor,
                        weight: style.strokeWidth,
                        fillColor: style.fillColor,
                        fillOpacity: style.fillOpacity,
                    });
                });
                break;
            default:
                throw new Error(`Set style not implemented for geometry type '${this.geometry.type}')`);
        }
    }

    inflate_popup(container) {
        var self = this;
        container.innerHTML = "";
        let wrapper = create(container, "div", ["feature-popup"]);
        let label = create(wrapper, "span", ["feature-label"]);
        label.textContent = this.properties.label;
        let table = create(wrapper, "div", ["feature-properties"]);
        for (let property in this.properties) {
            if (RESERVERD_PROPERTIES.has(property)) continue;
            let tr = create(table, "div", ["feature-property"]);
            let cell_property = create(tr, "div", ["feature-property-label"]);
            cell_property.textContent = property;
            let cell_value = create(tr, "div", ["feature-property-value"]);
            cell_value.textContent = this.properties[property];
        }
        if (this.layer.map.readonly) return;
        let buttons = create(wrapper, "div", ["feature-buttons"]);
        let button_edit = create(buttons, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        button_edit.innerHTML = `<i class="icon icon-edit"></i>`;
        button_edit.title = "Edit";
        button_edit.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflate_popup_edit(container);
        });
        let button_delete = create(buttons, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        button_delete.innerHTML = `<i class="icon icon-delete"></i>`;
        button_delete.title = "Delete";
        button_delete.addEventListener("click", (event) => {
            event.stopPropagation();
            self.layer.delete_feature(self.index);
        });
    }

    inflate_popup_edit(container) {
        var self = this;
        container.innerHTML = "";
        let wrapper = create(container, "div", ["feature-popup"]);
        let inputs_values = {};
        let inputs_labels = {};
        let label_input = create(wrapper, "input", ["form-input"]);
        label_input.value = this.properties.label;
        inputs_values.label = label_input;
        let table = create(wrapper, "div", ["feature-properties"]);
        let added_properties_counter = 0;
        for (let property in this.properties) {
            if (RESERVERD_PROPERTIES.has(property)) continue;
            let tr = create(table, "div", ["feature-property"]);
            let cell_property = create(tr, "div", ["feature-property-label"]);
            let input_label = create(cell_property, "input", ["form-input"]);
            input_label.value = property;
            inputs_labels[property] = input_label;
            let cell_value = create(tr, "div", ["feature-property-value"]);
            let input_value = create(cell_value, "input", ["form-input"]);
            input_value.value = this.properties[property];
            inputs_values[property] = input_value;
            let cell_buttons = create(tr, "div", ["feature-property-buttons"]);
            let delete_button = create(cell_buttons, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
            delete_button.innerHTML = `<i class="icon icon-delete"></i>`;
            delete_button.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm(`Do you want to delete the property ${property}?`)) {
                    delete inputs_values[property];
                    delete inputs_labels[property];
                    remove(tr);
                }
            });
        }
        let style_form = create(wrapper, "form", ["feature-style"]);
        let stroke_color_input;
        let stroke_width_input;
        let fill_color_input;
        let fill_opacity_input;
        if (this.geometry.type != "Point" && this.geometry.type != "MultiPoint") {
            create(style_form, "span", ["feature-style-label"]).textContent = "Stroke color";
            stroke_color_input = create(style_form, "input", ["feature-style-input", "form-input"]);
            stroke_color_input.type = "color";
            stroke_color_input.value = this.properties.strokeColor;
            inputs_values["strokeColor"] = stroke_color_input;
            create(style_form, "span", ["feature-style-label"]).textContent = "Stroke width";
            stroke_width_input = create(style_form, "input",  ["feature-style-input", "form-input"]);
            stroke_width_input.type = "range";
            stroke_width_input.min = "0";
            stroke_width_input.max = "10";
            stroke_width_input.step = "0.1";
            stroke_width_input.value = this.properties.strokeWidth;
            inputs_values["strokeWidth"] = stroke_width_input;
        }
        if (this.geometry.type != "LineString" && this.geometry.type != "MultiLineString") {
            create(style_form, "span", ["feature-style-label"]).textContent = "Fill color";
            fill_color_input = create(style_form, "input", ["feature-style-input", "form-input"]);
            fill_color_input.type = "color";
            fill_color_input.value = this.properties.fillColor;
            inputs_values["fillColor"] = fill_color_input;
            if (this.geometry.type != "Point" && this.geometry.type != "MultiPoint") {
                create(style_form, "span", ["feature-style-label"]).textContent = "Fill opacity";
                fill_opacity_input = create(style_form, "input", ["feature-style-input", "form-input"]);
                fill_opacity_input.type = "range";
                fill_opacity_input.min = "0";
                fill_opacity_input.max = "1";
                fill_opacity_input.step = "0.01";
                fill_opacity_input.value = this.properties.fillOpacity;
                inputs_values["fillOpacity"] = fill_opacity_input;
            }
        }
        style_form.addEventListener("change", () => {
            let customStyle = {
                strokeColor: stroke_color_input ? stroke_color_input.value : self.properties.strokeColor,
                strokeWidth: stroke_width_input ? stroke_width_input.value : self.properties.strokeWidth,
                fillColor: fill_color_input ? fill_color_input.value : self.properties.fillColor,
                fillOpacity: fill_opacity_input ? fill_opacity_input.value : self.properties.fillOpacity,
            }
            self.set_style(customStyle);
        });
        let buttons = create(wrapper, "div");
        let button_save = create(buttons, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        button_save.innerHTML = `<i class="icon icon-save"></i>`
        button_save.title = "Save";
        button_save.addEventListener("click", (event) => {
            event.stopPropagation();
            self.properties = {};
            for (let property in inputs_values) {    
                if (property in inputs_labels) {
                    self.properties[inputs_labels[property].value] = inputs_values[property].value;
                } else {
                    self.properties[property] = inputs_values[property].value;
                }
            }
            self.inflate();
            self.onchange("edit-feature");
        });
        let button_add = create(buttons, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        button_add.innerHTML = `<i class="icon icon-plus"></i>`
        button_add.title = "Add";
        button_add.addEventListener("click", (event) => {
            event.stopPropagation();
            added_properties_counter++;
            let property = `Property ${added_properties_counter}`;
            let tr = create(table, "div", ["feature-property"]);
            let cell_property = create(tr, "div", ["feature-property-label"]);
            let input_label = create(cell_property, "input", ["form-input"]);
            input_label.value = "";
            inputs_labels[property] = input_label;
            let cell_value = create(tr, "div", ["feature-property-value"]);
            let input_value = create(cell_value, "input", ["form-input"]);
            input_value.value = "";
            inputs_values[property] = input_value;
            let cell_buttons = create(tr, "div", ["feature-property-buttons"]);
            let delete_button = create(cell_buttons, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
            delete_button.innerHTML = `<i class="icon icon-delete"></i>`;
            delete_button.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm(`Do you want to delete the property ${property}?`)) {
                    delete inputs_values[property];
                    delete inputs_labels[property];
                    remove(tr);
                }
            });
            self.onchange("edit-feature");
        });
        let button_cancel = create(buttons, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        button_cancel.innerHTML = `<i class="icon icon-cross"></i>`
        button_cancel.title = "Cancel";
        button_cancel.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflate_popup(container);
        });
    }

    inflate_map_element() {
        var self = this;
        if (this.map_element != null) {
            this.layer.map.leaflet_map.removeLayer(this.map_element);
        }
        let parts = [];
        switch(this.geometry.type) {
            case "Point":
                this.map_element = L.marker(reverse_latlng(this.geometry.coordinates));
                break;
            case "LineString":
                this.map_element = L.polyline(reverse_latlng(this.geometry.coordinates));
                break;
            case "Polygon":
                this.map_element = L.polygon(reverse_latlng(this.geometry.coordinates));
                break;
            case "MultiPoint":
                this.geometry.coordinates.forEach(part_coordinates => {
                    parts.push(L.marker(reverse_latlng(part_coordinates)));
                });
                this.map_element = L.featureGroup(parts);
                break;
            case "MultiLineString":
                this.geometry.coordinates.forEach(part_coordinates => {
                    parts.push(L.polyline(reverse_latlng(part_coordinates)));
                });
                this.map_element = L.featureGroup(parts);
                break;
            case "MultiPolygon":
                this.geometry.coordinates.forEach(part_coordinates => {
                    parts.push(L.polygon(reverse_latlng(part_coordinates)));
                });
                this.map_element = L.featureGroup(parts);
                break;
            default:
                throw new Error("Not implemented!");
        }
        this.map_element.addTo(this.layer.map.leaflet_map);
        this.set_style();
        this.map_element.bindPopup(l => {
            let container = create();
            self.inflate_popup(container);
            return container;
        }, {minWidth: 200, maxWidth: 500});
        this.map_element.bindTooltip(this.properties.label);
        this.map_element.addEventListener("popupclose", () => {
            try {
                self.set_style();
            } catch {
                //pass: this may fail if element is being recreated
            }
        });
        this.map_element.addEventListener("editable:disable", () => {
            self.save_geometry();
        });
    }

    save_geometry() {
        switch(this.geometry.type) {
            case "Point":
                let latlng = this.map_element.getLatLng();
                this.geometry.coordinates = [latlng.lng, latlng.lat]; 
                break;
            case "LineString":
            case "Polygon":
                this.geometry.coordinates = this.map_element.toGeoJSON().geometry.coordinates;
                break;
            case "MultiPoint":
                this.geometry.coordinates = [];
                this.map_element.eachLayer(l => {
                    let llatlng = this.map_element.getLatLng();
                    this.geometry.coordinates.push([llatlng.lng, llatlng.lat]); 
                });
                break;
            case "MultiLineString":
            case "MultiPolygon":
                this.geometry.coordinates = [];
                this.map_element.eachLayer(l => {
                    this.geometry.coordinates.push(l.toGeoJSON().geometry.coordinates); 
                });
                break;
            default:
                throw new Error("Not implemented!");
        }
    }

    start_highlight() {
        this.set_style({
            strokeColor: get_opposite_color(this.properties.strokeColor),
            strokeWidth: this.properties.strokeWidth,
            fillColor: get_opposite_color(this.properties.fillColor),
            fillOpacity: this.properties.fillOpacity,
        })
    }

    end_highlight() {
        this.set_style();
    }

    inflate_panel_element() {
        var self = this;
        if (this.panel_element != null) {
            remove(this.panel_element);
        }
        this.panel_element = create(this.layer.features_container, "li", ["map-feature"]);
        this.panel_element.innerHTML = "";
        let label = create(this.panel_element, "span");
        label.textContent = this.properties.label;
        let move_button = create(this.panel_element, "span", ["btn", "btn-sm", "show-on-parent-hover", "btn-feature"]);
        move_button.innerHTML = `<i class="icon icon-arrow-right"></i>`;
        move_button.title = "Move to another layer";
        move_button.addEventListener("click", (event) => {
            event.stopPropagation();
            new MoveFeatureDialog(self.layer.map, self.layer.index, self.index).open();
        });
        this.panel_element.addEventListener("mouseenter", (event) => {
            self.start_highlight();
        });
        this.panel_element.addEventListener("mouseleave", (event) => {
            self.end_highlight();
        });
        label.addEventListener("dblclick", (event) => {
            event.stopPropagation();
            self.goto();
        });
    }

    inflate() {
        this.inflate_map_element();
        this.inflate_panel_element();
    }

    onchange(change) {
        this.layer.onchange(change);
    }

    delete() {
        if (this.panel_element != null) {
            remove(this.panel_element);
            this.panel_element = null;
        }
        if (this.map_element != null) {
            this.map_element.remove();
            this.map_element = null;
        }
    }

    goto() {
        if (this.geometry.type == "Point") {
            this.layer.map.leaflet_map.flyTo(reverse_latlng(this.geometry.coordinates));
        } else {
            this.layer.map.leaflet_map.fitBounds(this.map_element.getBounds());
        }
    }

    enableEdit() {
        if (this.map_element instanceof L.FeatureGroup) {
            this.map_element.eachLayer(l => l.enableEdit());
        } else {
            this.map_element.enableEdit();
        }
    }

    disableEdit() {
        if (this.map_element instanceof L.FeatureGroup) {
            this.map_element.eachLayer(l => l.disableEdit());
        } else {
            this.map_element.disableEdit();
        }
    }

}


class Layer {

    constructor(map, index, label) {
        this.map = map;
        this.index = index;
        this.label = label;
        this.features = [];
        this.container = null;
        this.visibility_checkbox = null;
        this.label_element = null;
        this.features_container = null;
        this.selected = false;
        this.feature_index_counter = 0;
    }

    find_default_label() {
        let i = 0;
        while (true) {
            i++;
            let label = `Untitled ${i}`;
            let found = false;
            for (let j = 0; j < this.features.length; j++) {
                if (this.features[j].properties.label == label) {
                    found = true;
                    break;
                }
            }
            if (!found) return label;
        }
    }

    inflate_label_edit() {
        var self = this;
        let input = create(null, "input", ["form-input"]);
        input.value = this.label;
        input.addEventListener("mousedown", stop_propagation);
        input.addEventListener("click", stop_propagation);
        input.addEventListener("dblclick", stop_propagation);
        input.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
                self.label = input.value.trim();
                self.inflate();
                self.onchange("edit-layer");
            }
        });
        this.label_element.replaceWith(input);
        input.focus();
    }

    inflate() {
        var self = this;
        if (this.container == null) {
            this.container = create(this.map.panel_control.layers_container, "div", ["map-layer"]);
            this.container.addEventListener("click", () => {
                self.map.select_layer(self.index);
            });
        }
        this.container.innerHTML = "";        
        let header_container = create(this.container, "div", ["d-flex"]);
        header_container.style.alignItems = "center";
        let header_container_label = create(create(header_container, "div", ["form-group", "mb-0"]), "label", ["form-switch"]);
        header_container_label.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        this.visibility_checkbox = create(header_container_label, "input");
        this.visibility_checkbox.type = "checkbox";
        this.visibility_checkbox.checked = true;
        this.visibility_checkbox.addEventListener("dblclick", (event) => {
            event.stopPropagation();
        });
        this.visibility_checkbox.addEventListener("input", () => {
            self.toggle_visibility();
        });
        create(header_container_label, "i", ["form-icon"]);
        this.label_element = create(header_container, "span", ["map-layer-title"]);
        this.label_element.textContent = this.label;
        this.label_element.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            self.inflate_label_edit();
        });
        let details = create(this.container, "details");
        let summary = create(details, "summary");
        summary.textContent = `${this.features.length} elements`;
        this.features_container = create(details, "ul", ["map-features"]);
        this.features.forEach(feature => {
            feature.inflate();
        });
        if (this.map.readonly) return;
        let edit_button = create(this.container, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        edit_button.innerHTML = `<i class="icon icon-edit"></i>`;
        edit_button.title = "Edit style";
        edit_button.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.select_layer(self.index);
            self.map.open_layer_style_dialog();
        });
        let import_button = create(this.container, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        import_button.innerHTML = `<i class="icon icon-upload"></i>`;
        import_button.title = "Import GeoJson";
        import_button.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.select_layer(self.index);
            self.map.open_import_dialog();
        });
        let export_button = create(this.container, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        export_button.innerHTML = `<i class="icon icon-download"></i>`;
        export_button.title = "Export to GeoJson";
        export_button.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.select_layer(self.index);
            self.export_to_geojson();
        });
        let delete_button = create(this.container, "span", ["btn", "btn-action", "btn-sm", "mr-1"]);
        delete_button.innerHTML = `<i class="icon icon-delete"></i>`;
        delete_button.title = "Delete";
        delete_button.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.delete_layer(self.index);
        });
        dragrank(this.features_container, ".map-feature", (ordering, permutation) => {
            dragrankReorder(self.features, permutation);
            self.onchange("feature-order");
        }, {
            dragid: "feature",
            domReorder: true,
        });
    }

    onchange(change) {
        this.map.onchange(change);
    }

    onselect() {
        this.selected = true;
        this.container.classList.add("selected");
    }

    onunselect() {
        this.selected = false;
        this.container.classList.remove("selected");
    }

    delete() {
        this.features.forEach(feature => {
            feature.delete();
        })
        remove(this.container);
    }

    add_feature(geojson_data) {
        this.features.push(new Feature(this, this.feature_index_counter, geojson_data));
        this.feature_index_counter++;
        this.inflate();
        this.onchange("add-feature");
    }

    add_features(geojson_data, replace=false) {
        while (replace) {
            let feature = this.features.pop();
            if (feature == undefined) break;
            feature.delete();
        }
        geojson_data.features.forEach(geojson_feature_data => {
            this.features.push(new Feature(this, this.feature_index_counter, geojson_feature_data));
            this.feature_index_counter++;
        });
        if (replace && "label" in geojson_data) {
            this.label = geojson_data.label;
        }
        this.inflate();
    }

    get_array_feature_index(feature_index) {
        for (let i = 0; i < this.features.length; i++) {
            if (this.features[i].index == feature_index) return i;
        }
    }

    get_feature(feature_index) {
        return this.features[this.get_array_feature_index(feature_index)];
    }

    delete_feature(feature_index) {
        let i = this.get_array_feature_index(feature_index);
        this.features[i].delete();
        this.features.splice(i, 1);
        this.onchange("delete-feature");
    }

    add_feature_from_map_element(map_element, base_properties=null) {
        let geojson_data = {
            type: "Feature",
            geometry: {
                type: null,
                coordinates: null,
            },
            properties: {}
        }
        if (base_properties == null) base_properties = {};
        let layer_style = this.most_common_or_default_style();
        for (let key in layer_style) {
            if (!(key in base_properties)) {
                base_properties[key] = layer_style[key];
            }
        }
        for (let property in base_properties) {
            geojson_data.properties[property] = base_properties[property];
        }
        if (map_element instanceof L.Marker) {
            geojson_data.geometry.type = "Point";
            let latlng = map_element.getLatLng();
            geojson_data.geometry.coordinates = [latlng.lng, latlng.lat]; 
        } else if (map_element instanceof L.Polygon) {
            //NOTE: this should be placed before L.Polyline,
            //      since it's a superclass of L.Polygon
            geojson_data.geometry.type = "Polygon";
            geojson_data.geometry.coordinates = map_element.toGeoJSON().geometry.coordinates;
        } else if (map_element instanceof L.Polyline) {
            geojson_data.geometry.type = "LineString";
            geojson_data.geometry.coordinates = map_element.toGeoJSON().geometry.coordinates;
        }
        this.map.leaflet_map.removeLayer(map_element);
        this.add_feature(geojson_data);
    }

    enableEdit() {
        this.features.forEach(feature => feature.enableEdit());
    }

    disableEdit() {
        this.features.forEach(feature => feature.disableEdit());
    }

    toggle_visibility() {
        let visible = this.visibility_checkbox.checked;
        this.features.forEach(feature => {
            if (visible) {
                feature.inflate_map_element();
            } else {
                feature.map_element.remove();
                feature.map_element = null;
            }
        });
    }

    to_geojson() {
        let feature_array = [];
        this.features.forEach(feature => {
            feature_array.push(feature.to_geojson());
        });
        return {
            type: "FeatureCollection",
            features: feature_array,
            label: this.label,
        }
    }

    export_to_geojson() {
        let geojson_data = this.to_geojson();
        let geojson_string = JSON.stringify(geojson_data);
        let link = document.createElement("a");
        link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(geojson_string);
        link.download = `${this.label}.geojson`;
        link.click();
    }

    most_common_property_value(property) {
        let occs = {};
        let max_value = null;
        let max_count = 0;
        this.features.forEach(f => {
            let value = property in f.properties ? f.properties[property] : null;
            if (!(value in occs)) occs[value] = 0;
            occs[value] += 1;
            if (occs[value] > max_count) {
                max_value = value;
                max_count = occs[value];
            }
        });
        return max_value;
    }

    most_common_or_default_style() {
        return {
            strokeColor: or_default(this.most_common_property_value("strokeColor"), DEFAULT_STROKE_COLOR),
            strokeWidth: or_default(this.most_common_property_value("strokeWidth"), DEFAULT_STROKE_COLOR),
            fillColor: or_default(this.most_common_property_value("fillColor"), DEFAULT_STROKE_COLOR),
            fillOpacity: or_default(this.most_common_property_value("fillOpacity"), DEFAULT_STROKE_COLOR),
        };
    }

}


class Map {

    constructor(mid, container, readonly=false) {
        this.mid = mid;
        this.container = container;
        this.readonly = readonly;
        this.container_left = null;
        this.container_right = null;
        this.leaflet_map = null;
        this.editable = true;
        this.layers = [];
        this.panel_control = null;
        this.selected_layer = null;
        this.layer_index_counter = 0;
        this.editing = false;
        this.title = "Untitled map";
        this.provider_index = 0;
        this.tile_layer = null;
        this.button_save = null;
    }

    set_tile_layer(provider_index) {
        this.provider_index = provider_index;
        this.load_tile_layer();
        this.onchange("edit-map");
    }

    load_tile_layer() {
        if (this.tile_layer != null) {
            this.leaflet_map.removeLayer(this.tile_layer);
            this.tile_layer = null;
        }
        let provider = PROVIDERS[this.provider_index];
        this.tile_layer = L.tileLayer(provider.tiles, provider.options);
        this.tile_layer.addTo(this.leaflet_map);
    }

    inflate_map() {
        this.leaflet_map = L.map(this.container, {
            editable: this.editable,
            zoomControl: false,
        }).setView([46, 2], 6);
        this.leaflet_map.on('editable:vertex:ctrlclick editable:vertex:metakeyclick', function (e) {
            e.vertex.continue();
        });
        this.load_tile_layer();
        L.control.zoom({position: "bottomright"}).addTo(this.leaflet_map);
        this.panel_control = new PanelControl(this);
        this.panel_control.addTo(this.leaflet_map);
        new CurrentPositionControl().addTo(this.leaflet_map);
        if (this.readonly) return;
        new SearchControl(this).addTo(this.leaflet_map);
        new ToolbarControl(this).addTo(this.leaflet_map);
    }

    fit_view_to_features() {
        let features = [];
        this.layers.forEach(layer => {
            layer.features.forEach(feature => {
                features.push(feature.map_element);
            });
        });
        let group = new L.featureGroup(features);
        this.leaflet_map.fitBounds(group.getBounds());
    }

    inflate() {
        this.container.innerHTML = "";
        this.container.classList.add("map-container");
        this.inflate_map();
        this.layers.forEach(layer => {
            layer.inflate();
        });
        this.setup_layer_dragrank();
    }

    setup(geojson_data, config) {
        if (config != null) {
            if ("title" in config) this.title = config.title;
            if ("provider_index" in config) this.provider_index = config.provider_index;
        }
        this.inflate();
        if (geojson_data != null) {
            geojson_data.forEach(layer_data => {
                this.add_layer();
                this.add_geojson_from_data(layer_data, true);
            });
            this.fit_view_to_features();
        }
        if (this.button_save != null) {
            this.button_save.disabled = true;
        }
    }

    add_layer() {
        let i = 0;
        let label = null; 
        while (true) {
            i++;
            label = `Untitled layer ${i}`;
            let found = false;
            for (let j = 0; j < this.layers.length; j++) {
                if (this.layers[j].label == label) {
                    found = true;
                    break;
                }
            }
            if (!found) break;
        }
        let layer = new Layer(this, this.layer_index_counter, label);
        this.layer_index_counter++;
        this.layers.push(layer);
        layer.inflate();
        this.select_layer(layer.index);
        this.onchange("add-layer");
        this.setup_layer_dragrank();
    }

    setup_layer_dragrank() {
        if (this.readonly) return;
        var self = this;
        dragrankClear("layer");
        dragrank(this.panel_control.layers_container, ".map-layer", (ordering, permutation) => {
            dragrankReorder(self.layers, permutation);
            self.onchange("layer-order");
        }, {
            dragid: "layer",
            domReorder: true,
        });
    }

    get_array_layer_index(layer_index) {
        for (let i = 0; i < this.layers.length; i++) {
            if (this.layers[i].index == layer_index) return i;
        }
    }

    get_layer(layer_index) {
        return this.layers[this.get_array_layer_index(layer_index)];
    }

    get_selected_layer() {
        if (this.selected_layer == null && this.layers.length > 0) {
            this.selected_layer = this.layers[0].index;
            this.layers[0].onselect();
        }
        return this.get_layer(this.selected_layer);
    }

    add_geojson_from_url(geojson_url, replace=false) {
        var self = this;
        fetch(geojson_url).then(res => res.json()).then(geojson_data => {
            self.get_selected_layer().add_features(geojson_data, replace);
        });
    }

    add_geojson_from_data(geojson_data, replace=false) {
        this.get_selected_layer().add_features(geojson_data, replace);
    }

    select_layer(layer_index) {
        if (this.selected_layer != null) {
            this.get_layer(this.selected_layer).onunselect();
        }
        this.selected_layer = layer_index;
        this.get_layer(this.selected_layer).onselect();
    }

    delete_layer(layer_index) {
        if (this.readonly) return;
        this.get_layer(layer_index).delete();
        this.layers.splice(this.get_array_layer_index(layer_index), 1);
        if (this.selected_layer == layer_index) {
            this.selected_layer = null;
        }
        this.onchange("delete-layer");
    }

    add_feature_on_commit(el) {
        var self = this;
        el.addEventListener("editable:drawing:commit", (event) => {
            self.get_selected_layer().add_feature_from_map_element(el);
        });
    }

    start_marker() {
        if (this.readonly) return;
        this.add_feature_on_commit(this.leaflet_map.editTools.startMarker());
    }

    start_polyline() {
        if (this.readonly) return;
        this.add_feature_on_commit(this.leaflet_map.editTools.startPolyline());
    }

    start_polygon() {
        if (this.readonly) return;
        this.add_feature_on_commit(this.leaflet_map.editTools.startPolygon());
    }

    toggle_edition() {
        if (this.readonly) return;
        this.editing = !this.editing;
        if (this.editing) {
            this.layers.forEach(layer => {
                layer.enableEdit();
            });
        } else {
            this.layers.forEach(layer => {
                layer.disableEdit();
            });
            this.onchange("edit-feature");
        }
    }

    onchange(change) {
        if (this.readonly) return;
        console.log("Change:", change);
        if (this.button_save != null) {
            this.button_save.removeAttribute("disabled");
        }
    }

    open_import_dialog() {
        if (this.readonly) return;
        new ImportGeojsonDialog(this).open();
    }

    open_layer_style_dialog() {
        if (this.readonly) return;
        new LayerStyleDialog(this).open();
    }

    to_geojson() {
        let layer_array = [];
        this.layers.forEach(layer => {
            layer_array.push(layer.to_geojson());
        });
        return layer_array;
    }

    set_title(new_title) {
        if (this.readonly) return;
        this.title = new_title;
        this.onchange("edit-map");
    }

    export() {
        let geojson_object = this.to_geojson();
        let config_object = {
            provider_index: this.provider_index,
        }
        return {
            title: this.title,
            geojson: JSON.stringify(geojson_object),
            config: JSON.stringify(config_object)
        };
    }

    save_data() {
        if (this.readonly) return;
        let save_form_data = new FormData();
        save_form_data.set("csrfmiddlewaretoken", CSRF_TOKEN);
        save_form_data.set("mid", this.mid);
        let map_export = this.export();
        save_form_data.set("title", map_export.title);
        save_form_data.set("geojson", map_export.geojson);
        save_form_data.set("config", map_export.config);
        fetch(URL_API + "?action=save-map", {
            method: "post",
            body: save_form_data
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    toast("Saved!", 600);
                    if (this.button_save != null) {
                        this.button_save.setAttribute("disabled", true);
                    }
                } else {
                    toast("An error occured", 600);
                }
            })
            .catch(err => {
                console.error(err);
                toast("An error occured", 600);
            });
    }

}


class Dialog {

    constructor() {
        this.element = null;
        this.overlay = null;
        this.container = null;
    }

    open() {
        var self = this;
        document.querySelectorAll(".dialog").forEach(remove);
        this.element = create(document.body, "div", ["dialog"]);
        this.overlay = create(this.element, "span", ["dialog-overlay"]);
        this.overlay.addEventListener("click", () => { self.close(); });
        this.container = create(this.element, "div", ["dialog-container"]);
    }

    close() {
        document.body.removeChild(this.element);
    }

}


class ImportGeojsonDialog extends Dialog {

    constructor(map) {
        super();
        this.map = map;
    }

    open() {
        var self = this;
        super.open();
        let title = create(this.container, "div", ["dialog-title"]);
        title.textContent = "Import GeoJson";
        let form = create(this.container, "form");
        let input = create(form, "input", ["form-input", "my-2"]);
        input.type = "file";
        input.accept = ".json, .geojson";
        input.required = true;
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let files = input.files;
            if (files.length > 0) {
                self.map.add_geojson_from_url(URL.createObjectURL(files[0]), event.submitter.name == "replace");
            }
            self.close();
        });
        let import_add = create(form, "input", ["btn", "mr-1"]);
        import_add.type = "submit";
        import_add.name = "add";
        import_add.value = "Add";
        let import_replace = create(form, "input", ["btn", "mr-1"]);
        import_replace.type = "submit";
        import_replace.name = "replace";
        import_replace.value = "Replace";
        let cancel_button = create(form, "button", ["btn"]);
        cancel_button.textContent = "Cancel";
        cancel_button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            self.close();
            return false;
        });
    }

}


function or_default(value, default_) {
    return value == null ? default_ : value;
}


class LayerStyleDialog extends Dialog {

    constructor(map) {
        super();
        this.map = map;
    }

    open() {
        var self = this;
        super.open();
        let title = create(this.container, "div", ["dialog-title"]);
        title.textContent = "Edit Layer Style";
        let form = create(this.container, "form", ["d-flex"]);
        form.style.flexDirection = "column";
        let layer = this.map.get_selected_layer();

        create(form, "span", ["feature-style-label"]).textContent = "Stroke color";
        let stroke_color_input = create(form, "input", ["feature-style-input", "form-input"]);
        stroke_color_input.type = "color";
        stroke_color_input.value = or_default(layer.most_common_property_value("strokeColor"), DEFAULT_STROKE_COLOR);
        
        create(form, "span", ["feature-style-label"]).textContent = "Stroke width";
        let stroke_width_input = create(form, "input",  ["feature-style-input", "form-input"]);
        stroke_width_input.type = "range";
        stroke_width_input.min = "0";
        stroke_width_input.max = "10";
        stroke_width_input.step = "0.1";
        stroke_width_input.value = or_default(layer.most_common_property_value("strokeWidth"), DEFAULT_STROKE_WIDTH);

        create(form, "span", ["feature-style-label"]).textContent = "Fill color";
        let fill_color_input = create(form, "input", ["feature-style-input", "form-input"]);
        fill_color_input.type = "color";
        fill_color_input.value = or_default(layer.most_common_property_value("fillColor"), DEFAULT_FILL_COLOR);

        create(form, "span", ["feature-style-label"]).textContent = "Fill opacity";
        let fill_opacity_input = create(form, "input", ["feature-style-input", "form-input"]);
        fill_opacity_input.type = "range";
        fill_opacity_input.min = "0";
        fill_opacity_input.max = "1";
        fill_opacity_input.step = "0.01";
        fill_opacity_input.value = or_default(layer.most_common_property_value("fillOpacity"), DEFAULT_FILL_OPACITY);

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let stroke_color = stroke_color_input.value;
            let stroke_width = stroke_width_input.value;
            let fill_color = fill_color_input.value;
            let fill_opacity = fill_opacity_input.value;
            layer.features.forEach(f => {
                f.properties.strokeColor = stroke_color;
                f.properties.strokeWidth = stroke_width;
                f.properties.fillColor = fill_color;
                f.properties.fillOpacity = fill_opacity;
                f.set_style();
            });
            layer.onchange("edit-layer");
            self.close();
        });

        let buttons = create(form, "div", ["mt-2"]);

        let save_button = create(buttons, "input", ["btn", "mr-1"]);
        save_button.type = "submit";
        save_button.name = "save";
        save_button.value = "Save";
        let cancel_button = create(buttons, "button", ["btn"]);
        cancel_button.textContent = "Cancel";
        cancel_button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            self.close();
            return false;
        });
    }

}


class MoveFeatureDialog extends Dialog {

    constructor(map, src_layer_index, feature_index) {
        super();
        this.map = map;
        this.src_layer_index = src_layer_index;
        this.feature_index = feature_index;
    }

    open() {
        var self = this;
        super.open();
        let title = create(this.container, "div", ["dialog-title"]);
        title.textContent = "Move Feature to another Layer";
        let form = create(this.container, "form", ["d-flex"]);
        form.style.flexDirection = "column";
        let group = create(form, "div", ["form-group"]);
        create(group, "label", ["form-label"]).textContent = "Destination Layer";
        let select = create(group, "select", ["form-select"]);
        this.map.layers.forEach(layer => {
            let option = create(select, "option");
            option.value = layer.index;
            if (layer.index == this.src_layer_index) {
                option.selected = true;
            }
            option.textContent = layer.label;
        });
        let buttons = create(form, "div", ["d-flex"]);
        let move_button = create(buttons, "button", ["btn", "btn-primary", "mr-1"]);
        move_button.textContent = "Move";
        let cancel_button = create(buttons, "button", ["btn"]);
        cancel_button.textContent = "Cancel";
        cancel_button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            self.close();
            return false;
        });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let src = self.src_layer_index;
            let dst = null;
            select.querySelectorAll("option").forEach(option => {
                if (option.selected) {
                    dst = parseInt(option.value);
                }
            });
            self.close();
            if (src == dst || dst == null) return;
            let src_layer = self.map.get_layer(src);
            let dst_layer = self.map.get_layer(dst);
            dst_layer.add_feature(src_layer.get_feature(self.feature_index).to_geojson());
            src_layer.delete_feature(self.feature_index);
        });
    }

}


function initialize_map(map_seed, readonly) {
    var map = null;
    let map_id = map_seed.getAttribute("map-id");
    fetch(URL_API + `?action=map&mid=${map_id}`, {
        method: "get",
        })
        .then(res => res.json())
        .then(map_data => {
            // sheet = new Sheet(sheet_id, sheet_seed, readonly);
            map = new Map(map_id, map_seed, readonly);
            let geojson = null;
            if (map_data.geojson != null && map_data.geojson.trim() != "") {
                geojson = JSON.parse(map_data.geojson);
            }
            let config = {};
            if (map_data.config != null && map_data.config.trim() != "") {
                config = JSON.parse(map_data.config);
            }
            config.title = map_data.title;
            map.setup(geojson, config);
        });

}


function initialize_maps(readonly) {
    document.querySelectorAll(".map-seed").forEach(map_seed => {
        initialize_map(map_seed, readonly);
    });
}
