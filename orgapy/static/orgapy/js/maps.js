/******************************************************************************/
/* GLOBAL VARIABLES */

const PROVIDERS = [
    {
        label: "Open Street Map",
        tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        options: {
            maxZoom: 19,
            attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors`,
            referrerPolicy: 'strict-origin-when-cross-origin',
        }
    },
    {
        label: "Open Topo Map",
        tiles: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        options: {
            maxZoom: 17,
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
            referrerPolicy: 'strict-origin-when-cross-origin',
        }
    },
    {
        label: "Esri World Imagery",
        tiles: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        options: {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            referrerPolicy: 'strict-origin-when-cross-origin',
        }
    },
    {
        label: "Positron",
        tiles: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        options: {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
            subdomains: 'abcd',
        }
    },
    {
        label: "Positron NoLabels",
        tiles: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        options: {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
            subdomains: 'abcd',
        }
    },
    {
        label: "DarkMatter",
        tiles: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        options: {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
            subdomains: 'abcd',
        }
    },
    {
        label: "DarkMatter NoLabels",
        tiles: "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
        options: {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            maxZoom: 20,
            subdomains: 'abcd',
        }
    },
    {
        label: "None",
        tiles: null
    }
];

const MYLOCATION_ICON = L.divIcon({
    className: 'marker-icon',
    html: `<svg viewBox="0 0 64 64"><path fill="#0080ff" d="M 30.540279,1.3185368 C 21.85287,1.7355383 13.407023,5.9858694 8.0183511,12.833493 3.9546162,17.921357 1.5435875,24.318441 1.3176227,30.832208 c -0.00742,0.341758 -0.034104,1.122627 -0.019034,1.633173 0.1026939,8.958812 4.3632131,17.765213 11.3510433,23.379104 6.80836,5.55241 16.060068,7.975408 24.710313,6.392653 8.481481,-1.477834 16.226182,-6.700437 20.734752,-14.041597 4.79067,-7.664124 5.952252,-17.483415 2.996549,-26.034261 C 58.391991,14.137344 52.247379,7.3329317 44.473788,3.9482133 40.11815,2.0124147 35.302284,1.1003088 30.540279,1.3185368 Z m 1.476563,8.3125 C 39.697214,9.5670689 47.223518,13.826397 51.14992,20.4246 55.254274,27.112498 55.445145,35.993992 51.580062,42.831811 47.864087,49.659959 40.365376,54.233805 32.585544,54.366339 25.493337,54.582485 18.407012,51.187995 14.156807,45.500692 9.7545982,39.722426 8.4278763,31.744166 10.799036,24.868004 13.315628,17.185047 20.318132,11.177024 28.319917,9.9414043 29.541014,9.7397576 30.779281,9.6379001 32.016842,9.6310368 Z M 31.426998,21.998224 c -3.731676,0.203908 -7.267254,2.672273 -8.660156,6.154297 -0.737458,1.688316 -0.960826,3.786778 -0.592715,5.666585 0.666555,4.033484 4.074272,7.402597 8.113666,8.029574 3.92568,0.759566 8.171616,-1.151858 10.212856,-4.588115 2.201744,-3.403129 1.967243,-8.137213 -0.544354,-11.315076 -1.961397,-2.654135 -5.247824,-4.12239 -8.529297,-3.947265 z"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const SEARCHRESULT_ICON = L.divIcon({
    className: 'marker-icon',
    html: `<svg viewBox="0 -2 64 68"><path stroke-width="2" stroke="black" fill="#ff0000" d="M 32.875 0 C 20.75 0 15.3125 9.4375 15.3125 16.6875 C 15.3125 30.398224 32.875 38.023232 32.875 64 C 32.875 38.023232 50.4375 30.398224 50.4375 16.6875 C 50.4375 9.4375 45 0 32.875 0 z "/></svg>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
});

const MARKER_ICONS = {
    "circle": L.divIcon({
        className: 'marker-icon',
        html: `<svg viewBox="-40 -40 80 80"><circle cx="0" cy="0" r="32" stroke-width="inherit" fill="inherit" stroke="inherit"></svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    }),
    "rectangle": L.divIcon({
        className: 'marker-icon',
        html: `<svg viewBox="-40 -40 80 80"><rect x="-32" y="-32" width="64" height="64" stroke-width="inherit" fill="inherit" stroke="inherit"></svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    }),
    "cross": L.divIcon({
        className: "marker-icon",
        html: `<svg viewBox="8 8 64 64"><path stroke-width="inherit" fill="inherit" stroke="inherit" d="M 57.406981,14.980574 40,32.387554 22.593019,14.980574 14.980574,22.593019 32.387554,40 14.980574,57.406981 22.593019,65.019426 40,47.612446 57.406981,65.019426 65.019426,57.406981 47.612446,40 65.019426,22.593019 Z" /></svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    }),
    "plus": L.divIcon({
        className: "marker-icon",
        html: `<svg viewBox="8 8 64 64"><path stroke-width="inherit" fill="inherit" stroke="inherit" d="M 34.617188 10 L 34.617188 34.617188 L 10 34.617188 L 10 45.382812 L 34.617188 45.382812 L 34.617188 70 L 45.382812 70 L 45.382812 45.382812 L 70 45.382812 L 70 34.617188 L 45.382812 34.617188 L 45.382812 10 L 34.617188 10 z " /></svg>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    }),
}

const MARKER_ICON_CHARS = {
    circle: "●",
    rectangle: "◼",
    cross: "✕",
    plus: "+"
}

const RESERVERD_PROPERTIES = new Set(["label", "strokeColor", "strokeWidth", "fillColor", "fillOpacity", "markerIcon"]);
const DEFAULT_STROKE_COLOR = "#000000";
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_FILL_COLOR = "#0080ff";
const DEFAULT_FILL_OPACITY = 25;
const DEFAULT_MARKER_ICON = "circle";

/******************************************************************************/
/* UTILITIES */

function orDefault(value, default_) {
    return value == null ? default_ : value;
}

function setDefault(object, attrname, value) {
    if (object[attrname] == undefined) {
        object[attrname] = value;
    }
}

function reverseLatLng(coordinates) {
    if ((coordinates.length == 2 || coordinates.length == 3) && typeof(coordinates[0]) == "number") {
        return [coordinates[1], coordinates[0]];
    }
    let output = [];
    coordinates.forEach(part => {
        output.push(reverseLatLng(part));
    });
    return output;
}

function hexToHsl(hex) {
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

function hslToHex(h, s, l) {
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

function getOppositeColor(color) {
    if (color == null || color == undefined) return DEFAULT_STROKE_COLOR;
    let hsl = hexToHsl(color);
    return hslToHex((hsl[0] + 180) % 360, hsl[1], hsl[2]);
}

function swapSibling(node2, node1) {
    node1.parentNode.replaceChild(node1, node2);
    node1.parentNode.insertBefore(node2, node1);
}

function createMapButton(container, title, iconClass, callback) {
    const button = create(container, "button");
    button.innerHTML = `<i class="${iconClass}"></i>`;
    button.title = title;
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        callback();
    });
    button.addEventListener("dblclick", (event) => {event.stopPropagation()});
    return button;
}

function computeDistance(latlngs) {
    let distance = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        distance += latlngs[i].distanceTo(latlngs[i + 1]);
    }
    return distance;
}

function formatDistance(meters) {
    if (meters < 1000) {
        return Math.round(meters) + " m";
    } else if (meters < 20000) {
        return (meters / 1000).toFixed(1) + " km";
    } else {
        return (meters / 1000).toFixed(0) + " km";
    }
}

function createStyleForm(container, initialStyle) {

    const form = create(container, "form", "style-form");

    const createColorInput = (inputs, name) => {
        const input = create(inputs, "input");
        input.type = "color";
        input.name = name;
        input.value = initialStyle[name];
    }

    const createIntegerInput = (inputs, name, minValue, maxValue) => {
        const input = create(inputs, "input");
        input.type = "number";
        input.min = minValue;
        input.max = maxValue;
        input.step = 1;
        input.name = name;
        input.value = initialStyle[name];
    }

    const createGroup = (label, callback) => {
        const group = create(form, "div", "style-form-group");
        create(group, "div", "style-form-label").textContent = label;
        callback(create(group, "div", "style-form-inputs"));
        return group;
    }

    createGroup("Stroke", (inputs) => {
        createColorInput(inputs, "strokeColor");
        createIntegerInput(inputs, "strokeWidth", 0, 16);
    });

    createGroup("Fill", (inputs) => {
        createColorInput(inputs, "fillColor");
        createIntegerInput(inputs, "fillOpacity", 0, 100);
    });

    createGroup("Marker", (inputs) => {
        const select = create(inputs, "select", "feature-style-input");
        select.name = "markerIcon";
        for (const cls in MARKER_ICONS) {
            const option = create(select, "option");
            option.value = cls;
            option.textContent = MARKER_ICON_CHARS[cls];
        }
        select.value = initialStyle.markerIcon;
    });

    return form;
}

/******************************************************************************/
/* LEAFLET CONTROLS */

const preventDefaultAndStopPropagation = (e) => {e.preventDefault(); e.stopPropagation()};

L.Control.Zoom = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create("div");
        container.classList.add("actionbar")
        container.classList.add("actionbar--vertical");

        const buttonZoomIn = create(container, "button");
        buttonZoomIn.innerHTML = `<i class="ri-add-line"></i>`;
        buttonZoomIn.addEventListener("click", (event) => {
            event.preventDefault();
            map.zoomIn();
        });

        buttonZoomIn.ondblclick = preventDefaultAndStopPropagation;

        const buttonZoomOut = create(container, "button");
        buttonZoomOut.innerHTML = `<i class="ri-subtract-line"></i>`;
        buttonZoomOut.addEventListener("click", (event) => {
            event.preventDefault();
            map.zoomOut();
        });

        buttonZoomOut.ondblclick = preventDefaultAndStopPropagation;

        return container;
    },
    onRemove: function(map) {}
});

L.control.zoom = function(opts) {
    return new L.Control.Zoom(opts);
}

L.Control.MyLocation = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create("div");
        container.classList.add("actionbar");

        var active = false;
        var marker;
        function onPosition(position) {
            if (marker == undefined) {
                marker = new L.Marker([position.coords.latitude, position.coords.longitude], {icon: MYLOCATION_ICON});
                marker.addTo(map);
            }
            marker.setLatLng(new L.LatLng(position.coords.latitude, position.coords.longitude));
        }

        function panToPosition(position) {
            map.panTo(new L.LatLng(position.coords.latitude, position.coords.longitude));
        }

        const button = create(container, "button");
        button.innerHTML = `<i class="ri-focus-2-line"></i>`;
        button.addEventListener("click", (event) => {
            event.preventDefault();
            if (!active) {
                active = true;
                if ("geolocation" in navigator) {
                    navigator.geolocation.getCurrentPosition((position) => {onPosition(position); panToPosition(position)});
                    navigator.geolocation.watchPosition((position) => {onPosition(position)});
                } else {
                    console.log("Geolocation not available, skipping");
                }
            }
            if (marker != undefined) {
                map.panTo(marker.getLatLng());
            }
        });
        button.ondblclick = preventDefaultAndStopPropagation;

        return container;
    },
    onRemove: function(map) {

    }
});

L.control.mylocation = function(opts) {
    return new L.Control.MyLocation(opts);
}

L.Control.Home = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create("div");
        container.classList.add("actionbar");

        function trigger() {
            const layers = [];
            map.eachLayer(layer => {if (Object.keys(layer.options).length > 0 && !("setUrl" in layer)) layers.push(layer)});
            if (layers.length === 0) return;
            const group = new L.featureGroup(layers);
            map.fitBounds(group.getBounds());
        }

        const button = create(container, "button");
        button.innerHTML = `<i class="ri-home-line"></i>`;
        button.addEventListener("click", (event) => {
            event.preventDefault();
            trigger();
        });
        button.ondblclick = preventDefaultAndStopPropagation;

        setTimeout(trigger, 1);

        return container;
    },
    onRemove: function(map) {}
});

L.control.home = function(opts) {
    return new L.Control.Home(opts);
}

/******************************************************************************/

class Feature {

    constructor(layer, index, geojsonData) {
        this.layer = layer;
        this.index = index;
        this.geometry = {};
        this.geometry.type = geojsonData.geometry.type;
        // NOTE: coordinates are stored using the GeoJson order,
        // ie. longitude first, then latitude.
        // Leafleft uses the reversed, order.
        // To switch, @see `reverseLatLng`
        this.geometry.coordinates = geojsonData.geometry.coordinates;
        this.properties = geojsonData.properties;
        setDefault(this.properties, "label", this.layer.findDefaultLabel());
        setDefault(this.properties, "strokeColor", DEFAULT_STROKE_COLOR);
        setDefault(this.properties, "strokeWidth", DEFAULT_STROKE_WIDTH);
        setDefault(this.properties, "fillColor", DEFAULT_FILL_COLOR);
        setDefault(this.properties, "fillOpacity", DEFAULT_FILL_OPACITY);
        setDefault(this.properties, "markerIcon", DEFAULT_MARKER_ICON);
        this.mapElement = null;
        this.panelElement = null;
        this.editing = false;
    }

    toGeojson() {
        const o = {
            type: "Feature",
            geometry: {
                type: this.geometry.type,
                coordinates: this.geometry.coordinates
            },
            properties: {},
        }
        for (let property in this.properties) {
            o.properties[property] = this.properties[property];
        }
        return o;
    }

    setStyle(customStyle=null) {
        if (this.mapElement == null) return;
        this.layer.setLayerStyleHint();
        let style = customStyle == null ? this.properties : customStyle;
        switch(this.geometry.type) {
            case "Point":
                this.mapElement.setIcon(MARKER_ICONS[style.markerIcon]);
                this.mapElement._icon.style.stroke = style.strokeColor;
                this.mapElement._icon.style.strokeWidth = style.strokeWidth;
                this.mapElement._icon.style.fill = style.fillColor;
                break;
            case "LineString":
                this.mapElement.setStyle({
                    color: style.strokeColor,
                    weight: style.strokeWidth,
                });
                break;
            case "Polygon":
                this.mapElement.setStyle({
                    color: style.strokeColor,
                    weight: style.strokeWidth,
                    fillColor: style.fillColor,
                    fillOpacity: (style.fillOpacity / 100),
                });
                break;
            case "MultiPoint":
                this.mapElement.getLayers().forEach(marker => {
                    marker.setIcon(MARKER_ICONS[style.markerIcon]);
                    marker._icon.style.stroke = style.strokeColor;
                    marker._icon.style.strokeWidth = style.strokeWidth;
                    marker._icon.style.fill = style.fillColor;
                });
                break;
            case "MultiLineString":
                this.mapElement.getLayers().forEach(polyline => {
                    polyline.setStyle({
                        color: style.strokeColor,
                        weight: style.strokeWidth,
                    });
                });
                break;
            case "MultiPolygon":
                this.mapElement.getLayers().forEach(polygon => {
                    polygon.setStyle({
                        color: style.strokeColor,
                        weight: style.strokeWidth,
                        fillColor: style.fillColor,
                        fillOpacity: (style.fillOpacity / 100),
                    });
                });
                break;
            default:
                throw new Error(`Set style not implemented for geometry type '${this.geometry.type}')`);
        }
    }

    toggleEdition() {
        if (this.editing) {
            this.disableEdit();
            this.onChange("edit-feature");
        } else {
            this.enableEdit();
        }
        this.mapElement.closePopup();
    }

    duplicate() {
        const selfCopy = this.toGeojson();
        selfCopy.properties.label = `${selfCopy.properties.label} (copy)`;
        this.layer.addFeature(selfCopy);
    }

    removeFromLayer() {
        this.layer.deleteFeature(this.index);
    }

    inflatePopup(container) {
        var self = this;
        container.innerHTML = "";
        const wrapper = create(container, "div", "feature-popup");
        const header = create(wrapper, "div", "feature-popup-header");
        const label = create(header, "span", "feature-label");
        label.textContent = this.properties.label;
        const subtitle = create(header, "span");
        const layerLabel = create(subtitle, "span", "feature-layer-label");
        layerLabel.textContent = this.layer.label;
        const geometrySpan = create(subtitle, "span", "feature-geometry");
        const distance = this.getDistance();
        if (distance >= 0) {
            geometrySpan.textContent = formatDistance(distance);
        } else {
            const center = this.getCenter();
            geometrySpan.textContent = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
        }
        const table = create(create(wrapper, "div", "feature-properties-wrapper"), "div", "feature-properties");
        for (let property in this.properties) {
            if (RESERVERD_PROPERTIES.has(property)) continue;
            let tr = create(table, "div", "feature-property");
            let cellProperty = create(create(tr, "div", "feature-property-label"), "div");
            cellProperty.textContent = property;
            let cellValue = create(create(tr, "div", "feature-property-value"), "div");
            cellValue.textContent = this.properties[property];
        }
        if (this.layer.map.readonly) return;
        const buttons = create(wrapper, "div", "feature-buttons");
        createMapButton(buttons, "Edit", "ri-pencil-fill", () => {self.inflatePopupEdit(container)});
        const toggleButton = createMapButton(buttons, "Toggle edition", "ri-drag-move-2-line", () => {self.toggleEdition()});
        if (this.editing) {
            toggleButton.classList.add("invert");
        }
        createMapButton(buttons, "Duplicate", "ri-file-copy-2-line", () => {self.duplicate()});
        createMapButton(buttons, "Delete", "ri-delete-bin-line", () => {self.removeFromLayer()});
    }

    inflatePopupEdit(container) {
        var self = this;
        container.innerHTML = "";
        const wrapper = create(container, "div", "feature-popup");
        const inputsValues = {};
        const inputsLabels = {};

        const header = create(wrapper, "div", "feature-popup-header");

        const labelInput = create(header, "input", "feature-label input-inline");
        labelInput.value = this.properties.label;
        inputsValues.label = labelInput;

        const layerLabel = create(header, "span", "feature-layer-label");
        layerLabel.textContent = this.layer.label;

        const table = create(create(wrapper, "div", "feature-properties-wrapper"), "div", "feature-properties");
        var addedPropertiesCounter = 0;
        for (let property in this.properties) {
            if (RESERVERD_PROPERTIES.has(property)) continue;
            let tr = create(table, "div", "feature-property");
            let cellProperty = create(tr, "div", "feature-property-label");
            let inputLabel = create(cellProperty, "input", "input-inline");
            inputLabel.value = property;
            inputsLabels[property] = inputLabel;
            let cellValue = create(tr, "div", "feature-property-value");
            let inputValue = create(cellValue, "input", "input-inline");
            inputValue.value = this.properties[property];
            inputsValues[property] = inputValue;
            let cellButtons = create(tr, "div", "feature-property-buttons");
            let deleteButton = create(cellButtons, "button");
            deleteButton.innerHTML = `<i class="ri-delete-bin-line"></i>`;
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm(`Do you want to delete the property '${property}'?`)) {
                    delete inputsValues[property];
                    delete inputsLabels[property];
                    remove(tr);
                }
            });
        }

        const styleForm = createStyleForm(wrapper, this.properties);
        styleForm.classList.add("style-form-popup");

        const buttons = create(wrapper, "div", "feature-buttons");

        createMapButton(buttons, "Save", "ri-save-line", () => {
            self.properties = {};
            for (let property in inputsValues) {
                if (property in inputsLabels) {
                    self.properties[inputsLabels[property].value] = inputsValues[property].value;
                } else {
                    self.properties[property] = inputsValues[property].value;
                }
            }
            const formData = new FormData(styleForm);
            for (const [property, value] of formData.entries()) {
                self.properties[property] = value;
            }
            self.inflate();
            self.mapElement.openPopup();
            self.onChange("edit-feature");
        });

        createMapButton(buttons, "Add property", "ri-add-line", () => {
            addedPropertiesCounter++;
            let property = `Property ${addedPropertiesCounter}`;
            let tr = create(table, "div", "feature-property");
            let cellProperty = create(tr, "div", "feature-property-label");
            let inputLabel = create(cellProperty, "input", "input-inline");
            inputLabel.placeholder = "Label";
            inputLabel.value = "";
            inputsLabels[property] = inputLabel;
            let cellValue = create(tr, "div", "feature-property-value");
            let inputValue = create(cellValue, "input", "input-inline");
            inputValue.placeholder = "Value";
            inputValue.value = "";
            inputsValues[property] = inputValue;
            let cellButtons = create(tr, "div", "feature-property-buttons");
            let deleteButton = create(cellButtons, "button");
            deleteButton.innerHTML = `<i class="ri-delete-bin-line"></i>`;
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm(`Do you want to delete the property '${property}'?`)) {
                    delete inputsValues[property];
                    delete inputsLabels[property];
                    remove(tr);
                }
            });
            self.onChange("edit-feature");
        });

        createMapButton(buttons, "Cancel", "ri-close-line", () => {
            self.inflatePopup(container);
        });

    }

    inflateMapElement() {
        var self = this;
        if (this.mapElement != null) {
            this.layer.featureGroup.removeLayer(this.mapElement);
        }
        let parts = [];
        switch(this.geometry.type) {
            case "Point":
                this.mapElement = L.marker(reverseLatLng(this.geometry.coordinates));
                break;
            case "LineString":
                this.mapElement = L.polyline(reverseLatLng(this.geometry.coordinates));
                break;
            case "Polygon":
                this.mapElement = L.polygon(reverseLatLng(this.geometry.coordinates));
                break;
            case "MultiPoint":
                this.geometry.coordinates.forEach(partCoordinates => {
                    parts.push(L.marker(reverseLatLng(partCoordinates)));
                });
                this.mapElement = L.featureGroup(parts);
                break;
            case "MultiLineString":
                this.geometry.coordinates.forEach(partCoordinates => {
                    parts.push(L.polyline(reverseLatLng(partCoordinates)));
                });
                this.mapElement = L.featureGroup(parts);
                break;
            case "MultiPolygon":
                this.geometry.coordinates.forEach(partCoordinates => {
                    parts.push(L.polygon(reverseLatLng(partCoordinates)));
                });
                this.mapElement = L.featureGroup(parts);
                break;
            default:
                throw new Error("Not implemented!");
        }
        this.layer.featureGroup.addLayer(this.mapElement);
        this.setStyle();

        let minPopupWidth = 300;
        let maxPopupWidth = 500;
        if (window.innerWidth <= 500) {
            maxPopupWidth = window.innerWidth - 16;
        } else {
            maxPopupWidth = Math.min(maxPopupWidth, window.innerWidth - 16 - 350);
        }
        this.mapElement.bindPopup(l => {
            const container = create();
            self.inflatePopup(container);
            return container;
        }, {minWidth: minPopupWidth, maxWidth: maxPopupWidth});
        this.mapElement.bindTooltip(this.properties.label);
        this.mapElement.addEventListener("editable:disable", () => {
            self.saveGeometry();
        });
    }

    setLabelFromProperty(propertyName) {
        if (propertyName in this.properties) {
            this.properties.label = this.properties[propertyName];
        } else {
            this.properties.label = this.layer.findDefaultLabel();
        }
        this.inflate();
        this.onChange("edit-feature");
    }

    saveGeometry() {
        switch(this.geometry.type) {
            case "Point":
                let latlng = this.mapElement.getLatLng();
                this.geometry.coordinates = [latlng.lng, latlng.lat];
                break;
            case "LineString":
            case "Polygon":
                this.geometry.coordinates = this.mapElement.toGeoJSON().geometry.coordinates;
                break;
            case "MultiPoint":
                this.geometry.coordinates = [];
                this.mapElement.eachLayer(l => {
                    let llatlng = this.mapElement.getLatLng();
                    this.geometry.coordinates.push([llatlng.lng, llatlng.lat]);
                });
                break;
            case "MultiLineString":
            case "MultiPolygon":
                this.geometry.coordinates = [];
                this.mapElement.eachLayer(l => {
                    this.geometry.coordinates.push(l.toGeoJSON().geometry.coordinates);
                });
                break;
            default:
                throw new Error("Not implemented!");
        }
    }

    startHighlight() {
        this.setStyle({
            strokeColor: getOppositeColor(this.properties.strokeColor),
            strokeWidth: this.properties.strokeWidth,
            fillColor: getOppositeColor(this.properties.fillColor),
            fillOpacity: this.properties.fillOpacity,
            markerIcon: this.properties.markerIcon
        })
    }

    endHighlight() {
        this.setStyle();
    }

    moveUp() {
        this.layer.moveFeatureUp(this.index);
    }

    moveDown() {
        this.layer.moveFeatureDown(this.index);
    }

    openMoveDialog() {
        new MoveFeatureDialog(this.layer.map, this.layer.index, this.index).open();
    }

    focus() {
        this.goto();
        if (this.mapElement != null) {
            this.mapElement.openPopup();
        }
    }

    inflatePanelElement() {
        var self = this;
        if (this.panelElement != null) {
            remove(this.panelElement);
        }
        this.panelElement = document.createElement("li");
        this.panelElement.classList.add("map-feature");
        if (this.layer.featuresContainer.childNodes.length > this.index) {
            this.layer.featuresContainer.insertBefore(this.panelElement, this.layer.featuresContainer.childNodes[this.index]);
        } else {
            this.layer.featuresContainer.appendChild(this.panelElement);
        }
        const icon = create(this.panelElement, "i");
        if (this.geometry.type == "Point" || this.geometry.type == "MultiPoint") {
            icon.className = "ri-map-pin-line";
        } else if (this.geometry.type == "LineString" || this.geometry.type == "MultiLineString") {
            icon.className = "ri-route-line";
        } else {
            icon.className = "ri-shape-line";
        }
        const hasLabel = this.properties.label != undefined && this.properties.label != "";
        create(this.panelElement, "span", "map-feature-label ellipsis").innerHTML = hasLabel ? this.properties.label : "<i>&lt;null&gt;</i>";
        if (!this.layer.map.readonly) {
            const buttons = create(this.panelElement, "span", "map-feature-buttons");
            createMapButton(buttons, "Move up", "ri-arrow-up-line", () => {self.moveUp()});
            createMapButton(buttons, "Move down", "ri-arrow-down-line", () => {self.moveDown()});
            createMapButton(buttons, "Move to another layer", "ri-arrow-right-line", () => {self.openMoveDialog()});
        }
        this.panelElement.addEventListener("mouseenter", () => {self.startHighlight()});
        this.panelElement.addEventListener("mouseleave", () => {self.endHighlight()});
        this.panelElement.addEventListener("click", (event) => {
            event.stopPropagation();
            self.focus();
        });
    }

    inflate() {
        this.inflateMapElement();
        this.inflatePanelElement();
    }

    onChange(change) {
        this.layer.onChange(change);
    }

    delete() {
        if (this.panelElement != null) {
            remove(this.panelElement);
            this.panelElement = null;
        }
        if (this.mapElement != null) {
            this.mapElement.remove();
            this.mapElement = null;
        }
    }

    goto() {
        if (this.geometry.type == "Point") {
            let zoom = Math.max(this.layer.map.leafletMap.getZoom(), 13);
            this.layer.map.leafletMap.flyTo(reverseLatLng(this.geometry.coordinates), zoom, {duration: 0.3});
        } else {
            this.layer.map.leafletMap.fitBounds(this.mapElement.getBounds(), {duration: 0.3});
        }
    }

    getCenter() {
        if (this.geometry.type == "Point") {
            return this.mapElement.getLatLng();
        } else {
            return this.mapElement.getBounds().getCenter();
        }
    }

    enableEdit() {
        this.editing = true;
        if (this.mapElement instanceof L.FeatureGroup) {
            this.mapElement.eachLayer(l => l.enableEdit());
        } else {
            this.mapElement.enableEdit();
        }
    }

    disableEdit() {
        this.editing = false;
        if (this.mapElement instanceof L.FeatureGroup) {
            this.mapElement.eachLayer(l => l.disableEdit());
        } else {
            this.mapElement.disableEdit();
        }
    }

    show() {
        if (!this.layer.visible) return;
        this.panelElement.classList.remove("hidden");
        if (this.mapElement == null) {
            this.inflateMapElement();
        }
    }

    hide(hideInPanel=true) {
        if (hideInPanel) this.panelElement.classList.add("hidden");
        if (this.mapElement != null) {
            this.mapElement.remove();
            this.mapElement = null;
        }
    }

    getDistance() {
        if (this.geometry.type == "Point" || this.geometry.type == "MultiPoint") {
            return -1;
        } else if (this.geometry.type == "LineString" || this.geometry.type == "MultiLineString") {
            try {
                return computeDistance(this.mapElement.getLatLngs());
            } catch {
                return -1;
            }
        } else {
            try {
                return computeDistance(this.mapElement.getLatLngs()[0]);
            } catch {
                return -1;
            }
        }
    }

}

class Layer {

    constructor(map, index, label, visible) {
        this.map = map;
        this.index = index;
        this.label = label;
        this.features = [];
        this.featureGroup = null;
        this.container = null;
        this.visibilityCheckbox = null;
        this.labelElement = null;
        this.counterLabel = null;
        this.featuresContainer = null;
        this.selected = false;
        this.visible = visible;
    }

    findDefaultLabel() {
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

    inflateLabelEdit() {
        var self = this;
        let input = create(null, "input");
        input.type = "text";
        input.value = this.label;
        input.addEventListener("mousedown", (e) => {e.stopPropagation()});
        input.addEventListener("click", (e) => {e.stopPropagation()});
        input.addEventListener("dblclick", (e) => {e.stopPropagation()});
        input.addEventListener("keydown", (event) => {
            if (event.key == "Enter") {
                self.label = input.value.trim();
                self.inflate();
                self.onChange("edit-layer");
            }
        });
        this.labelElement.replaceWith(input);
        input.focus();
    }

    setLayerStyleHint() {
        const style = this.mostCommonOrDefaultStyle();
        this.toggle.style.fill = style.fillColor;
        this.toggle.style.stroke = style.strokeColor;
        this.toggle.style.strokeWidth = style.strokeWidth;
    }

    moveUp() {
        this.map.moveLayerUp(this.index);
    }

    moveDown() {
        this.map.moveLayerDown(this.index);
    }

    resetFeatureLabels() {
        const propertyName = prompt("Provide the property name to use as label. Probably 'name' or 'title'.");
        if (propertyName == null || propertyName == "") return;
        for (const feature of this.features) {
            feature.setLabelFromProperty(propertyName);
        }
    }

    sortFeatures() {
        const promptText = "" +
            "Provide the property name to use as key. " +
            "You may use special keys 'lat' and 'lon'. " +
            "You may specify multiple keys, separated by commas. " +
            "Start a key with a minus to sort in decreasing order.";

        const query = prompt(promptText, "label")?.trim();
        if (query == null || query == "") return;

        const keys = query.split(",");
        for (let i = 0; i < keys.length; i++) {
            const keyString = keys[i];
            const decreasing = keyString.startsWith("-");
            keys[i] = [decreasing, decreasing ? keyString.slice(1) : keyString];
        }

        function compareFeatures(a, b) {
            for (const [decreasing, key] of keys) {
                let valueA, valueB;
                if (key == "lat" || key == "lon" || key == "lng" || key == "latitude" || key == "longitude") {
                    const posA = a.getCenter();
                    const posB = b.getCenter();
                    if (key == "lat" || key == "latitude") {
                        valueA = posA.lat;
                        valueB = posB.lat;
                    } else {
                        valueA = posA.lng;
                        valueB = posB.lng;
                    }
                } else {
                    valueA = a.properties[key];
                    valueB = b.properties[key];
                }
                if (valueA == valueB) continue;
                if (valueA < valueB) return decreasing ? 1 : -1;
                return decreasing ? -1 : 1;
            }
            return 0;
        }

        this.features.sort(compareFeatures);
        for (let i = 0; i < this.features.length; i++) {
            this.features[i].index = i;
        }

        this.inflate();
    }

    editStyle() {
        this.map.selectLayer(this.index);
        this.map.openLayerStyleDialog();
    }

    importGeojson() {
        this.map.selectLayer(this.index);
        this.map.openImportDialog();
    }

    askUserToDelete() {
        if (confirm(`Are you sure to delete "${this.label}"?`)) {
            this.map.deleteLayer(this.index);
        }
    }

    inflate() {
        var self = this;
        if (this.container == null) {
            const addLayerButton = this.map.layersContainer.children[this.map.layersContainer.children.length - 1];
            this.container = document.createElement("div")
            this.container.classList.add("map-layer");
            this.map.layersContainer.insertBefore(this.container, addLayerButton);
            this.container.addEventListener("click", () => {
                self.map.selectLayer(self.index);
            });
            this.featureGroup = L.featureGroup();
            this.featureGroup.addTo(this.map.leafletMap);
            this.featureGroup.setZIndex(this.index);
        }
        this.container.innerHTML = "";

        const summary = create(this.container, "div", "map-layer-summary");
        summary.ondblclick = () => {self.container.classList.toggle("open")};

        this.toggle = create(summary, "span", "map-layer-toggle");
        this.toggle.innerHTML = `<svg viewBox="0 0 64 64"><path d="M 6.5 9 L 51.6 32 L 6.5 54.9 L 6.5 9" stroke-linejoin="round" stroke-width="inherit" stroke="inherit" fill="inherit"/></svg>`
        this.toggle.onclick = () => {self.container.classList.toggle("open")};

        const labelContainer = create(summary, "span", "map-layer-label");

        this.labelElement = create(labelContainer, "span", "map-layer-title");
        this.labelElement.textContent = this.label;

        this.counterLabel = create(labelContainer, "span", "map-layer-count");
        this.counterLabel.textContent = `(${this.features.length})`;

        this.visibilityCheckbox = create(summary, "i", "map-layer-visible");
        if (this.visible) {
            this.visibilityCheckbox.classList.add("ri-eye-line");
        } else {
            this.visibilityCheckbox.classList.add("ri-eye-off-line");
        }
        this.visibilityCheckbox.addEventListener("click", () => {
            self.toggleVisibility();
        });

        this.setLayerStyleHint();

        if (!this.map.readonly) {
            const buttonsDropdown = create(summary, "span", "dropdown");

            const moreButton = create(buttonsDropdown, "a", "button-inline dropdown-toggle");
            moreButton.innerHTML = `<i class="ri-more-2-fill"></i>`;
            moreButton.tabIndex = 0;

            const buttonsMenu = create(buttonsDropdown, "ul", "menu");
            function createMenuButton(title, iconClass, callback) {
                const button = create(create(buttonsMenu, "li", "menu-item"), "button");
                button.innerHTML = `<i class="${iconClass}"></i> ${title}`;
                button.title = title;
                button.addEventListener("click", (event) => {
                    callback();
                });
            }
            createMenuButton("Rename layer", "ri-input-field", () => {self.inflateLabelEdit()});
            createMenuButton("Move up", "ri-arrow-up-line", () => {self.moveUp()});
            createMenuButton("Move down", "ri-arrow-down-line", () => {self.moveDown()});
            createMenuButton("Reset labels", "ri-pencil-fill", () => {self.resetFeatureLabels()});
            createMenuButton("Sort features", "ri-bar-chart-2-line", () => {self.sortFeatures()});
            createMenuButton("Edit style", "ri-paint-fill", () => {self.editStyle()});
            createMenuButton("Import GeoJSON", "ri-upload-line", () => {self.importGeojson()});
            createMenuButton("Export to GeoJSON", "ri-download-line", () => {self.exportToGeojson()});
            createMenuButton("Delete", "ri-delete-bin-line", () => {self.askUserToDelete()});

            bindDropdown(buttonsDropdown);
        }

        this.featuresContainer = create(this.container, "ul", "map-features");
        for (const feature of this.features) {
            if (this.visible) {
                feature.inflate();
            } else {
                feature.inflatePanelElement();
            }
        }

    }

    onChange(change) {
        this.map.onChange(change);
    }

    onSelect() {
        this.selected = true;
        this.container.classList.add("selected");
    }

    onUnselect() {
        this.selected = false;
        this.container.classList.remove("selected");
    }

    delete() {
        this.features.forEach(feature => {
            feature.delete();
        })
        this.featureGroup.remove();
        remove(this.container);
    }

    addFeature(geojsonData) {
        const feature = new Feature(this, this.features.length, geojsonData);
        this.features.push(feature);
        this.inflate();
        this.map.resetZIndices();
        this.onChange("add-feature");
        return feature;
    }

    moveFeatureUp(featureIndex) {
        if (featureIndex == 0) return;
        [this.features[featureIndex - 1], this.features[featureIndex]] = [this.features[featureIndex], this.features[featureIndex - 1]];
        this.features[featureIndex].index++;
        this.features[featureIndex-1].index--;
        this.inflate();
        this.onChange("edit-feature");
    }

    moveFeatureDown(featureIndex) {
        if (featureIndex >= this.features.length - 1) return;
        [this.features[featureIndex + 1], this.features[featureIndex]] = [this.features[featureIndex], this.features[featureIndex + 1]];
        this.features[featureIndex].index--;
        this.features[featureIndex+1].index++;
        this.inflate();
        this.onChange("edit-feature");
    }

    addFeatures(geojsonData, replace=false) {
        while (replace) {
            let feature = this.features.pop();
            if (feature == undefined) break;
            feature.delete();
        }
        geojsonData.features.forEach(geojsonFeatureData => {
            const feature = new Feature(this, this.features.length, geojsonFeatureData);
            this.features.push(feature);
        });
        if (replace && "label" in geojsonData) {
            this.label = geojsonData.label;
        }
        this.inflate();
    }

    getFeature(featureIndex) {
        return this.features[featureIndex];
    }

    deleteFeature(featureIndex) {
        this.features[featureIndex].delete();
        this.features.splice(featureIndex, 1);
        this.counterLabel.textContent = `(${this.features.length})`;
        for (let i = featureIndex; i < this.features.length; i++) {
            this.features[i].index--;
        }
        this.onChange("delete-feature");
    }

    addFeatureFromMapElement(mapElement, baseProperties=null) {
        let geojsonData = {
            type: "Feature",
            geometry: {
                type: null,
                coordinates: null,
            },
            properties: {}
        }
        if (baseProperties == null) baseProperties = {};
        let layerStyle = this.mostCommonOrDefaultStyle();
        for (let key in layerStyle) {
            if (!(key in baseProperties)) {
                baseProperties[key] = layerStyle[key];
            }
        }
        for (let property in baseProperties) {
            geojsonData.properties[property] = baseProperties[property];
        }
        if (mapElement instanceof L.Marker) {
            geojsonData.geometry.type = "Point";
            let latlng = mapElement.getLatLng();
            geojsonData.geometry.coordinates = [latlng.lng, latlng.lat];
        } else if (mapElement instanceof L.Polygon) {
            //NOTE: this should be placed before L.Polyline,
            //      since it's a superclass of L.Polygon
            geojsonData.geometry.type = "Polygon";
            geojsonData.geometry.coordinates = mapElement.toGeoJSON().geometry.coordinates;
        } else if (mapElement instanceof L.Polyline) {
            geojsonData.geometry.type = "LineString";
            geojsonData.geometry.coordinates = mapElement.toGeoJSON().geometry.coordinates;
        }
        this.map.leafletMap.removeLayer(mapElement);
        return this.addFeature(geojsonData);
    }

    enableEdit() {
        if (!this.visible) return;
        this.features.forEach(feature => feature.enableEdit());
    }

    disableEdit() {
        if (!this.visible) return;
        this.features.forEach(feature => feature.disableEdit());
    }

    toggleVisibility() {
        this.visible = !this.visible;
        if (this.visible) {
            this.visibilityCheckbox.classList.add("ri-eye-line");
            this.visibilityCheckbox.classList.remove("ri-eye-off-line");
        } else {
            this.visibilityCheckbox.classList.remove("ri-eye-line");
            this.visibilityCheckbox.classList.add("ri-eye-off-line");
        }
        this.onChange("layer-visible");
        for (const feature of this.features) {
            if (this.visible) {
                feature.show();
            } else {
                feature.hide(false);
            }
        }
        this.map.resetZIndices();
    }

    toGeojson() {
        let featureArray = [];
        this.features.forEach(feature => {
            featureArray.push(feature.toGeojson());
        });
        return {
            type: "FeatureCollection",
            features: featureArray,
            label: this.label,
            visible: this.visible,
        }
    }

    exportToGeojson() {
        this.map.selectLayer(this.index);
        const geojsonData = this.toGeojson();
        const geojsonString = JSON.stringify(geojsonData);
        const link = document.createElement("a");
        link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(geojsonString);
        link.download = `${this.label}.geojson`;
        link.click();
    }

    mostCommonPropertyValue(property) {
        let occs = {};
        let maxValue = null;
        let maxCount = 0;
        this.features.forEach(f => {
            let value = property in f.properties ? f.properties[property] : null;
            if (!(value in occs)) occs[value] = 0;
            occs[value] += 1;
            if (occs[value] > maxCount) {
                maxValue = value;
                maxCount = occs[value];
            }
        });
        return maxValue;
    }

    mostCommonOrDefaultStyle() {
        return {
            strokeColor: orDefault(this.mostCommonPropertyValue("strokeColor"), DEFAULT_STROKE_COLOR),
            strokeWidth: orDefault(this.mostCommonPropertyValue("strokeWidth"), DEFAULT_STROKE_WIDTH),
            fillColor: orDefault(this.mostCommonPropertyValue("fillColor"), DEFAULT_FILL_COLOR),
            fillOpacity: orDefault(this.mostCommonPropertyValue("fillOpacity"), DEFAULT_FILL_OPACITY),
            markerIcon: orDefault(this.mostCommonPropertyValue("markerIcon"), DEFAULT_MARKER_ICON),
        };
    }

    expand() {
        this.container.classList.add("open");
    }

    collapse() {
        this.container.classList.remove("open");
    }

}

L.Control.Draw = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create("div");
        container.classList.add("actionbar");
        var self = this;
        const ctrl = self.options.controller;
        createMapButton(container, "Add marker", "ri-map-pin-line", () => {ctrl.startMarker()});
        createMapButton(container, "Add polyline", "ri-route-line", () => {ctrl.startPolyline()});
        createMapButton(container, "Add polygon", "ri-shape-line", () => {ctrl.startPolygon()});
        var toggleButton;
        toggleButton = createMapButton(container, "Toggle edition", "ri-drag-move-2-line", () => {ctrl.toggleEdition(toggleButton)});
        return container;
    },
    onRemove: function(map) {}
});

L.control.draw = function(opts) {
    return new L.Control.Draw(opts);
}

L.Control.TileProvider = L.Control.extend({
    onAdd: function(map) {
        const container = L.DomUtil.create("div");
        container.classList.add("actionbar");
        var self = this;
        const ctrl = self.options.controller;
        const selectBaseMap = create(container, "select", "map-provider-select");
        selectBaseMap.setAttribute("id", "select-base-map");
        PROVIDERS.forEach((provider, i) => {
            const option = create(selectBaseMap, "option");
            option.value = i;
            option.textContent = provider.label;
        });
        selectBaseMap.value = ctrl.providerIndex;
        selectBaseMap.addEventListener("input", () => {
            ctrl.setTileLayer(parseInt(selectBaseMap.value));
        });
        return container;
    },
    onRemove: function(map) {}
});

L.control.tileProvider = function(opts) {
    return new L.Control.TileProvider(opts);
}

function splitQuery(query) {
    const split = [];
    let iStart = 0;
    let i = 1;
    let inQuotes = false;
    while (i < query.length - 1) {
        const c = query.charAt(i);
        if (c == "\"") {
            inQuotes = !inQuotes;
        } else if (c == " " && !inQuotes) {
            split.push(query.slice(iStart, i));
            iStart = i + 1;
        }
        i++;
    }
    if (iStart < query.length - 1) split.push(query.slice(iStart));
    return split;
}

const trimQuotes = (s) => {return s.replace(/^(\"+)/, "").replace(/(\"+)$/, "")};

function clearContextMenus() {
    let context_menus = document.querySelectorAll(".contextmenu");
    for (let i = 0; i < context_menus.length; i++) {
        document.body.removeChild(context_menus[i]);
    }
}

function addContextMenuOption(menu, iconClass, label, callback) {
    let option = menu.appendChild(document.createElement("li"));
    option.classList.add("menu-item");
    if (iconClass == null) {
        create(option, "button").textContent = label;
    } else {
        create(option, "button").innerHTML = `<i class="${iconClass}"></i> ${label}`;
    }
    option.addEventListener("click", () => {
        callback();
        clearContextMenus();
    });
}

function parseQuery(query) {
    const split = splitQuery(query);
    const filters = [];
    const tokens = [];
    const delimiters = [":", ">=", "<=", "=", "<", ">"];
    for (const part of split) {
        let foundDelimiter = false;
        for (const delimiter of delimiters) {
            const i = part.indexOf(delimiter);
            if (i >= 0) {
                filters.push({
                    property: part.slice(0, i),
                    constraint: delimiter,
                    value: trimQuotes(part.slice(i + delimiter.length).toLowerCase())
                })
                foundDelimiter = true;
                break;
            }
        }
        if (!foundDelimiter) {
            tokens.push(trimQuotes(part.toLowerCase()));
        }
    }
    return {filters: filters, tokens: tokens};
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
    toast("Copied to clipboard!", 600);
}

class Map {

    constructor(nonce, mapLayout, readonly=false) {
        this.nonce = nonce;
        this.dashboardContainer = mapLayout.querySelector(".map-dashboard");
        this.container = mapLayout.querySelector(".map-seed");
        this.readonly = readonly;
        this.leafletMap = null;
        this.editable = true;
        this.layers = [];
        this.userPositionWidget = null;
        this.dashboard = null;
        this.selectedLayer = null;
        this.editing = false;
        this.title = "Untitled map";
        this.providerIndex = 0;
        this.tileLayer = null;
        this.buttonSave = null;
        this.modification = null;
        this.layersContainer = null;
        this.distanceLine = null;
    }

    setTileLayer(providerIndex) {
        this.providerIndex = providerIndex;
        this.loadTileLayer();
        this.onChange("edit-map");
    }

    loadTileLayer() {
        if (this.tileLayer != null) {
            this.leafletMap.removeLayer(this.tileLayer);
            this.tileLayer = null;
        }
        let provider = PROVIDERS[this.providerIndex];
        if (provider.tiles != null) {
            this.tileLayer = L.tileLayer(provider.tiles, provider.options);
            this.tileLayer.addTo(this.leafletMap);
        }
    }

    updateMapCoordinates() {
        const label = this.dashboardContainer.querySelector(".map-coordinates");
        const center = this.leafletMap.getCenter();
        label.textContent = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
    }

    showAllFeatures() {
        for (const layer of this.layers) {
            for (const feature of layer.features) {
                feature.show();
            }
        }
    }

    onSearchFeature(query) {
        query = query.trim();

        if (query == "") {
            this.showAllFeatures();
            return;
        }

        const {filters, tokens} = parseQuery(query);

        for (const layer of this.layers) {
            if (layer.visible) {
                layer.expand();
            } else {
                layer.collapse();
                continue;
            }
            for (const feature of layer.features) {
                let show = true;
                const labelLower = feature.properties.label.toLowerCase();
                for (const token of tokens) {
                    if (!labelLower.includes(token)) {
                        show = false;
                        break;
                    }
                }
                let left, right;
                for (const filter of filters) {
                    if (!(filter.property in feature.properties)) {
                        show = false;
                        break;
                    }
                    switch (filter.constraint) {
                        case ":":
                            show = show && feature.properties[filter.property].toLowerCase().includes(filter.value);
                            break;
                        case "=":
                            show = show && feature.properties[filter.property].toLowerCase() == filter.value;
                            break;
                        case ">=":
                            left = parseFloat(feature.properties[filter.property]);
                            right = parseFloat(filter.value);
                            show = show && (left >= right);
                            break;
                        case "<=":
                            left = parseFloat(feature.properties[filter.property]);
                            right = parseFloat(filter.value);
                            show = show && (left <= right);
                            break;
                        case ">":
                            left = parseFloat(feature.properties[filter.property]);
                            right = parseFloat(filter.value);
                            show = show && (left > right);
                            break;
                        case "<":
                            left = parseFloat(feature.properties[filter.property]);
                            right = parseFloat(filter.value);
                            show = show && (left < right);
                            break;
                    }
                    if (!show) break;
                }
                if (show) {
                    feature.show();
                } else {
                    feature.hide();
                }
            }
        }
    }

    onSearchSubmit(query) {
        if (this.readonly) return;

        var self = this;

        query = query.trim();
        if (query == "") return;

        if (query.match(/^\-?\d+(\.\d+)? *, *\-?\d+(\.\d+)?$/g)) {
            this.onSearchResult(query.split(",")[0], query.split(",")[1], {label: "GPS Point"});
        } else {
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURI(query)}&format=jsonv2`;
            fetch(url).then(res => res.json()).then(results => {
                if (results.length == 0) {
                    alert("No result found");
                    return;
                } else if (results.length == 1) {
                    self.onSearchResult(results[0].lat, results[0].lon, {label: results[0].name, address: results[0].display_name});
                } else {
                    self.openSearchResultsDialog(query, results);
                }
            })
        }

        const searchbar = this.dashboardContainer.querySelector("form.search input[type=search]");
        searchbar.value = "";
        this.showAllFeatures();

    }

    onSearchResult(latitude, longitude, properties) {
        const marker = new L.marker([parseFloat(latitude), parseFloat(longitude)]);
        const feature = this.getSelectedLayer().addFeatureFromMapElement(marker, properties);
        this.leafletMap.panTo(marker.getLatLng());
        feature.mapElement.openPopup();
    }

    expandAllLayers() {
        for (const layer of this.layers) {
            layer.expand();
        }
    }

    collapseAllLayers() {
        for (const layer of this.layers) {
            layer.collapse();
        }
    }

    inflateDashboard() {
        var self = this;
        this.dashboardContainer.innerHTML = "";

        const header = create(this.dashboardContainer, "div", "map-header");

        if (!this.readonly) {
            const prevButton = create(header, "a", "link-hidden");
            prevButton.innerHTML = `<i class="ri-map-2-line"></i>`;
            prevButton.href = "../";
        }

        if (this.readonly) {
            create(header, "span", "map-title").textContent = this.title;
        } else {
            const titleInput = create(header, "input", "map-title input-inline");
            titleInput.placeholder = "Title";
            titleInput.value = this.title;
            titleInput.oninput = () => {
                if (self.readonly) return;
                self.title = titleInput.value.trim();
                self.onChange("edit-map");
            }
        }

        if (!this.readonly) {
            this.buttonSave = createMapButton(header, "Save", "ri-save-line", () => {self.saveData()});
        }

        const referencesTemplate = document.getElementById("template-refs");
        if (referencesTemplate != null) {
            const node = document.importNode(referencesTemplate.content, true);
            if (node.querySelector(".map-refs").children.length > 0) {
                this.dashboardContainer.appendChild(node);
            }
        }

        const searchForm = create(this.dashboardContainer, "form", "search");
        const searchBar = create(searchForm, "div", "search-bar");
        const searchInput = create(searchBar, "input", "search-input");
        searchInput.type = "search";
        searchInput.placeholder = "Search feature or location";
        const searchButton = create(searchBar, "button", "search-button");
        searchButton.innerHTML = `<i class="ri-search-line"></i>`;
        searchButton.title = "Search";
        searchInput.oninput = () => {
            self.onSearchFeature(searchInput.value);
        };
        searchForm.onsubmit = (e) => {
            e.preventDefault();
            self.onSearchSubmit(searchInput.value);
        }

        const layersButtons = create(this.dashboardContainer, "div", "row");
        const expandAllButton = create(layersButtons, "button", "button-slim hint");
        expandAllButton.textContent = "Expand all";
        expandAllButton.onclick = () => {self.expandAllLayers()};
        const collapseAllButton = create(layersButtons, "button", "button-slim hint");
        collapseAllButton.textContent = "Collapse all";
        collapseAllButton.onclick = () => {self.collapseAllLayers()};

        this.layersContainer = create(this.dashboardContainer, "div", "map-layers");
        this.layersContainer.addEventListener("wheel", (e) => {e.stopPropagation()});

        if (!this.readonly) {
            const buttonAddLayer = create(this.layersContainer, "button");
            buttonAddLayer.innerHTML = `<i class="ri-add-line"></i> Add layer`;
            buttonAddLayer.onclick = () => {self.addLayer()};
        }

        const footer = create(this.dashboardContainer, "div", "map-footer");
        create(footer, "div", "map-coordinates hint");
        this.updateMapCoordinates();
        this.leafletMap.addEventListener("move", () => {self.updateMapCoordinates()});

    }

    addMarker(latlng, defaultLabel="My Point") {
        const layer = this.getSelectedLayer();
        const properties = layer.mostCommonOrDefaultStyle();
        properties.label = defaultLabel;
        const feature = layer.addFeature({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [latlng.lng, latlng.lat],
            },
            properties: properties
        });
        feature.mapElement.openPopup();
    }

    inflateContextMenu(x, y, latlng) {
        var self = this;
        clearContextMenus();
        const menu = create(document.body, "ul", "contextmenu menu");
        const coordsString = `${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`;
        addContextMenuOption(menu, null, coordsString, () => {copyToClipboard(coordsString)});
        if (!this.readonly) {
            addContextMenuOption(menu, "ri-map-pin-line", "Add marker", () => {self.addMarker(latlng)});
        }
        if (this.isMeasuringDistance()) {
            addContextMenuOption(menu, "ri-route-line", "Stop distance measure", () => {self.stopMeasuringDistance()});
        } else {
            addContextMenuOption(menu, "ri-route-line", "Measure distance", () => {self.startMeasuringDistance(latlng)});
        }
        const bounds = menu.getBoundingClientRect();
        menu.style.left = Math.min(x, window.innerWidth - (bounds.width + 8)) + "px";
        menu.style.top = Math.min(y, window.innerHeight - (bounds.height + 8)) + "px";
    }

    inflateMap() {
        this.leafletMap = L.map(this.container, {
            editable: this.editable,
            zoomControl: false,
        }).setView([46, 2], 6);
        this.leafletMap.on("editable:vertex:ctrlclick editable:vertex:metakeyclick", function (e) {e.vertex.continue()});
        this.loadTileLayer();
        this.inflateDashboard();
        if (!this.readonly) {
            L.control.draw({position: "topleft", controller: this}).addTo(this.leafletMap);
        }
        L.control.tileProvider({position: "topright", controller: this}).addTo(this.leafletMap);
        L.control.zoom({position: "bottomright"}).addTo(this.leafletMap);
        L.control.mylocation({position: "bottomright"}).addTo(this.leafletMap);
        L.control.home({position: "bottomright"}).addTo(this.leafletMap);
        var self = this;
        this.leafletMap.on("click", (e) => {clearContextMenus()});
        this.leafletMap.on("movestart", (e) => {clearContextMenus()});
        this.leafletMap.on("contextmenu", (e) => {
            const bounds = self.container.getBoundingClientRect();
            self.inflateContextMenu(e.containerPoint.x + bounds.left, e.containerPoint.y + bounds.top, e.latlng);
        });
    }

    inflate() {
        this.container.innerHTML = "";
        this.container.classList.add("map-container");
        this.inflateMap();
        this.layers.forEach(layer => {
            layer.inflate();
        });
    }

    setup(geojsonData, config, modification) {
        this.modification = modification;
        if (config != null) {
            if ("title" in config) this.title = config.title;
            if ("providerIndex" in config) this.providerIndex = config.providerIndex;
        }
        this.inflate();
        if (geojsonData != null) {
            geojsonData.forEach(layerData => {
                this.addLayer(layerData.visible == true);
                this.addGeojsonFromData(layerData, true);
            });
        }
        if (this.buttonSave != null) {
            this.buttonSave.disabled = true;
        }
    }

    addLayer(visible=true) {
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
        let layer = new Layer(this, this.layers.length, label, visible);
        this.layers.push(layer);
        layer.inflate();
        this.selectLayer(layer.index);
        this.onChange("add-layer");
    }

    resetZIndices() {
        for (let i = 0; i < this.layers.length; i++) {
            this.layers[i].featureGroup.bringToFront();
        }
    }

    moveLayerUp(layerIndex) {
        if (layerIndex <= 0) return;
        [this.layers[layerIndex - 1], this.layers[layerIndex]] = [this.layers[layerIndex], this.layers[layerIndex - 1]];
        this.layers[layerIndex - 1].index--;
        this.layers[layerIndex].index++;
        this.selectedLayer--;
        swapSibling(this.layers[layerIndex - 1].container, this.layers[layerIndex].container);
        this.resetZIndices();
        this.onChange("layer-order");
    }

    moveLayerDown(layerIndex) {
        if (layerIndex >= this.layers.length - 1) return;
        [this.layers[layerIndex + 1], this.layers[layerIndex]] = [this.layers[layerIndex], this.layers[layerIndex + 1]];
        this.layers[layerIndex + 1].index++;
        this.layers[layerIndex].index--;
        this.selectedLayer++;
        swapSibling(this.layers[layerIndex].container, this.layers[layerIndex + 1].container);
        this.resetZIndices();
        this.onChange("layer-order");
    }

    getLayer(layerIndex) {
        return this.layers[layerIndex];
    }

    getSelectedLayer() {
        if (this.selectedLayer == null && this.layers.length > 0) {
            this.selectedLayer = this.layers[0].index;
            this.layers[0].onselect();
        }
        return this.getLayer(this.selectedLayer);
    }

    addGeojsonFromUrl(geojsonUrl, replace=false) {
        var self = this;
        fetch(geojsonUrl).then(res => res.json()).then(geojsonData => {
            self.getSelectedLayer().addFeatures(geojsonData, replace);
        });
    }

    addGeojsonFromData(geojsonData, replace=false) {
        this.getSelectedLayer().addFeatures(geojsonData, replace);
        this.onChange("layer-feature");
    }

    selectLayer(layerIndex) {
        if (this.selectedLayer != null) {
            this.getLayer(this.selectedLayer).onUnselect();
        }
        this.selectedLayer = layerIndex;
        this.getLayer(this.selectedLayer).onSelect();
    }

    deleteLayer(layerIndex) {
        if (this.readonly) return;
        this.getLayer(layerIndex).delete();
        this.layers.splice(layerIndex, 1);
        if (this.selectedLayer == layerIndex) {
            this.selectedLayer = null;
        }
        for (let i = layerIndex; i < this.layers.length; i++) {
            this.layers[i].index--;
        }
        this.onChange("delete-layer");
    }

    addFeatureOnCommit(el) {
        var self = this;
        el.addEventListener("editable:drawing:commit", (event) => {
            if (self.getSelectedLayer() == undefined) {
                toast("🛑 Select a layer first 🛑", TOAST_SHORT);
            } else {
                self.getSelectedLayer().addFeatureFromMapElement(el);
            }
        });
    }

    startMarker() {
        if (this.readonly) return;
        this.addFeatureOnCommit(this.leafletMap.editTools.startMarker());
    }

    startPolyline() {
        if (this.readonly) return;
        this.addFeatureOnCommit(this.leafletMap.editTools.startPolyline());
    }

    startPolygon() {
        if (this.readonly) return;
        this.addFeatureOnCommit(this.leafletMap.editTools.startPolygon());
    }

    toggleEdition(toggleButton) {
        if (this.readonly) return;
        this.editing = !this.editing;
        if (this.editing) {
            this.layers.forEach(layer => {
                layer.enableEdit();
            });
            toggleButton.classList.add("invert");
        } else {
            this.layers.forEach(layer => {
                layer.disableEdit();
            });
            toggleButton.classList.remove("invert");
            this.onChange("edit-feature");
        }
    }

    onChange(change) {
        if (this.readonly) return;
        //console.log("Change:", change);
        if (this.buttonSave != null) {
            this.buttonSave.removeAttribute("disabled");
        }
    }

    openImportDialog() {
        if (this.readonly) return;
        new ImportGeojsonDialog(this).open();
    }

    openLayerStyleDialog() {
        if (this.readonly) return;
        new LayerStyleDialog(this).open();
    }

    openSearchResultsDialog(searchQuery, searchResults) {
        if (this.readonly) return;
        new SearchResultsDialog(this, searchQuery, searchResults).open();
    }

    toGeojson() {
        let layerArray = [];
        this.layers.forEach(layer => {
            layerArray.push(layer.toGeojson());
        });
        return layerArray;
    }

    export() {
        let geojsonObject = this.toGeojson();
        let configObject = {
            providerIndex: this.providerIndex,
        }
        return {
            title: this.title,
            geojson: JSON.stringify(geojsonObject),
            config: JSON.stringify(configObject)
        };
    }

    saveData() {
        if (this.readonly) return;
        let mapExport = this.export();
        var self = this;
        apiPost("save-document",
            {
                "nonce": this.nonce,
                "title": mapExport.title,
                "content": mapExport.geojson,
                "config": mapExport.config,
                "modification": this.modification
            }, (data) => {
                toast("Saved!", 600);
                self.modification = data.modification;
                if (self.buttonSave != null) {
                    self.buttonSave.setAttribute("disabled", true);
                }
        });
    }

    isMeasuringDistance() {
        return this.distanceLine != null;
    }

    startMeasuringDistance(latlng) {
        if (this.isMeasuringDistance()) {
            this.stopMeasuringDistance();
        } 
        var self = this;
        const el = this.leafletMap.editTools.startPolyline(latlng);
        el.editor.addMiddleMarker = () => {};
        var firstEdit = true;
        const popupContainer = create(null, "div");
        const popupSpan = create(popupContainer, "span");
        popupSpan.textContent = "salut !";
        function updateTooltip() {
            const distance = computeDistance(el.getLatLngs());
            el.bindTooltip(formatDistance(distance));
            el.openTooltip();
        }
        el.addEventListener("editable:vertex:new", (e) => {
            if (firstEdit) {
                firstEdit = false;
                self.leafletMap.editTools.commitDrawing();
                setTimeout(() => {updateTooltip()}, 1);
            } else {
                e.cancel();
            }
        });
        el.addEventListener("editable:editing", () => {updateTooltip()});
        this.distanceLine = el;
    }

    stopMeasuringDistance() {
        if (this.distanceLine != null) {
            this.distanceLine.remove();
            this.distanceLine = null;
        }
    }
}

class Dialog {

    constructor() {
        this.element = null;
        this.overlay = null;
        this.container = null;
    }

    open(openAsModal=true) {
        var self = this;
        document.querySelectorAll("dialog").forEach(remove);
        this.element = create(document.body, "dialog");
        this.element.onclose = () => {self.close()}
        this.container = create(this.element, "div", "card");
        if (openAsModal) {
            this.element.setAttribute("closedby", "any");
            this.element.showModal();
        } else {
            this.element.setAttribute("closedby", "closerequest");
            this.element.classList.add("dialog--bottom");
            this.element.show();
        }
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
        const form = create(this.container, "form");
        let title = create(form, "h2", "card-header");
        title.textContent = "Import GeoJson";
        let body = create(form, "form", "card-body");
        let input = create(create(body, "p"), "input");
        input.type = "file";
        input.accept = ".json, .geojson";
        input.required = true;
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let files = input.files;
            if (files.length > 0) {
                self.map.addGeojsonFromUrl(URL.createObjectURL(files[0]), event.submitter.name == "replace");
            }
            self.close();
        });
        const buttons = create(form, "div", "card-actions");
        let importAdd = create(buttons, "input", "active");
        importAdd.type = "submit";
        importAdd.name = "add";
        importAdd.value = "Add";
        let importReplace = create(buttons, "input", "active");
        importReplace.type = "submit";
        importReplace.name = "replace";
        importReplace.value = "Replace";
        let cancelButton = create(buttons, "button");
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            self.close();
            return false;
        });
    }

}

class LayerStyleDialog extends Dialog {

    constructor(map) {
        super();
        this.map = map;
    }

    open() {
        var self = this;
        super.open();
        const title = create(this.container, "h2", "card-header");
        title.textContent = "Edit Layer Style";
        const layer = this.map.getSelectedLayer();

        const styleForm = createStyleForm(create(this.container, "div", "card-body"), {
            strokeColor: orDefault(layer.mostCommonPropertyValue("strokeColor"), DEFAULT_STROKE_COLOR),
            strokeWidth: orDefault(layer.mostCommonPropertyValue("strokeWidth"), DEFAULT_STROKE_WIDTH),
            fillColor: orDefault(layer.mostCommonPropertyValue("fillColor"), DEFAULT_FILL_COLOR),
            fillOpacity: orDefault(layer.mostCommonPropertyValue("fillOpacity"), DEFAULT_FILL_OPACITY),
            markerIcon: orDefault(layer.mostCommonPropertyValue("markerIcon"), DEFAULT_MARKER_ICON)
        });
        styleForm.classList.add("style-form-dialog");

        const buttons = create(this.container, "div", "card-actions");
        const saveButton = create(buttons, "button", "active");
        saveButton.textContent = "Save";
        saveButton.addEventListener("click", (event) => {
            event.preventDefault();
            const formData = new FormData(styleForm);
            layer.features.forEach(f => {
                f.properties.strokeColor = formData.get("strokeColor");
                f.properties.strokeWidth = formData.get("strokeWidth");
                f.properties.fillColor = formData.get("fillColor");
                f.properties.fillOpacity = formData.get("fillOpacity");
                f.properties.markerIcon = formData.get("markerIcon");
                f.setStyle();
            });
            layer.onChange("edit-layer");
            self.close();
        });
        const cancelButton = create(buttons, "button");
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            self.close();
            return false;
        });
    }

}

class MoveFeatureDialog extends Dialog {

    constructor(map, srcLayerIndex, featureIndex) {
        super();
        this.map = map;
        this.srcLayerIndex = srcLayerIndex;
        this.featureIndex = featureIndex;
    }

    open() {
        var self = this;
        super.open();
        const form = create(this.container, "form");
        let title = create(form, "h2", "card-header");
        title.textContent = "Move Feature to another Layer";
        const body = create(form, "div", "card-body");
        let group = create(body, "p");
        create(group, "label", "form-label").textContent = "Destination Layer";
        let select = create(group, "select");
        this.map.layers.forEach(layer => {
            let option = create(select, "option");
            option.value = layer.index;
            if (layer.index == this.srcLayerIndex) {
                option.selected = true;
            }
            option.textContent = layer.label;
        });
        let buttons = create(form, "div", "card-actions");
        let moveButton = create(buttons, "button", "active");
        moveButton.textContent = "Move";
        let cancelButton = create(buttons, "button");
        cancelButton.textContent = "Cancel";
        cancelButton.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            self.close();
            return false;
        });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let src = self.srcLayerIndex;
            let dst = null;
            select.querySelectorAll("option").forEach(option => {
                if (option.selected) {
                    dst = parseInt(option.value);
                }
            });
            self.close();
            if (src == dst || dst == null) return;
            let srcLayer = self.map.getLayer(src);
            let dstLayer = self.map.getLayer(dst);
            dstLayer.addFeature(srcLayer.getFeature(self.featureIndex).toGeojson());
            srcLayer.deleteFeature(self.featureIndex);
        });
    }

}

class SearchResultsDialog extends Dialog {

    constructor(map, query, results) {
        super();
        this.map = map;
        this.query = query;
        this.results = results;
        this.featureGroup = null;
    }

    open() {
        var self = this;
        super.open(false);
        this.featureGroup = new L.featureGroup().addTo(this.map.leafletMap);
        create(this.container, "h2", "card-header").textContent = this.query;
        const body = create(this.container, "div", "card-body search-results");
        body.style.maxHeight = "9rem";
        body.style.overflow = "auto";
        const actions = create(this.container, "div", "card-actions");
        const closeButton = create(actions, "button");
        closeButton.textContent = "Close";
        closeButton.onclick = () => {self.close()};
        for (const result of this.results) {
            const resultEl = create(body, "div", "search-result");
            resultEl.setAttribute("lat", result.lat);
            resultEl.setAttribute("lon", result.lon);
            const leftCol = create(resultEl, "div");
            const selectButton = create(leftCol, "button");
            selectButton.innerHTML = "<i class='ri-map-pin-line'></i>";
            const rightCol = create(resultEl, "div", "col");
            const primaryRow = create(rightCol, "div", "row");
            create(primaryRow, "span").textContent = result.name;
            const link = create(primaryRow, "a", "small link-hidden");
            link.href = `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`
            link.innerHTML = `<i class="ri-arrow-left-up-box-line"></i> OSM`
            const secondaryRow = create(rightCol, "div", "row hint");
            create(secondaryRow, "span", "hint").textContent = result.display_name;
            const marker = new L.Marker([parseFloat(result.lat), parseFloat(result.lon)], {icon: SEARCHRESULT_ICON});
            this.featureGroup.addLayer(marker);
            rightCol.onclick = () => {
                self.map.leafletMap.flyTo([parseFloat(result.lat), parseFloat(result.lon)], Math.max(13, self.map.leafletMap.getZoom()), {duration: 0.3});
            };
            selectButton.onclick = (e) => {
                e.stopPropagation();
                self.map.onSearchResult(result.lat, result.lon, {label: result.name, address: result.display_name});
                self.close();
            };
            marker.on("click", (e) => {
                self.map.leafletMap.flyTo([parseFloat(result.lat), parseFloat(result.lon)], Math.max(13, self.map.leafletMap.getZoom()), {duration: 0.3});
                document.querySelectorAll(".search-result.hover").forEach(el => {el.classList.remove("hover")});
                resultEl.classList.add("hover");
                resultEl.scrollIntoView();
            });
        }
        this.map.leafletMap.fitBounds(this.featureGroup.getBounds());
    }

    close() {
        this.featureGroup?.remove();
        super.close();
    }


}

function initializeMap(mapLayout, readonly) {
    var map = null;
    let mapNonce = mapLayout.getAttribute("map-nonce");
    fetch(URL_API + `?action=get-document&nonce=${mapNonce}`, {
        method: "get",
        })
        .then(res => res.json())
        .then(mapData => {
            map = new Map(mapNonce, mapLayout, readonly);
            let geojson = null;
            if (mapData.content != null && mapData.content.trim() != "") {
                geojson = JSON.parse(mapData.content);
            }
            let config = {};
            if (mapData.config != null && mapData.config.trim() != "") {
                config = JSON.parse(mapData.config);
            }
            config.title = mapData.title;
            map.setup(geojson, config, mapData.modification);
        });

}

function initializeMaps(readonly) {
    document.querySelectorAll(".map-layout").forEach(mapLayout => {
        initializeMap(mapLayout, readonly);
    });
}
