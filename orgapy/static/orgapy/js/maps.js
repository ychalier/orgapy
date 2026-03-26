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
];


function orDefault(value, default_) {
    return value == null ? default_ : value;
}


function setDefault(object, attrname, value) {
    if (object[attrname] == undefined) {
        object[attrname] = value;
    }
}


function stopPropagation(event) {
    event.stopPropagation();
    return false;
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


function getHueRotation(color, baseColor="#2981ca") {
    return hexToHsl(color)[0] - hexToHsl(baseColor)[0];
}

const crosshairIcon = L.icon({
    iconUrl: URL_IMAGE_CROSSHAIR,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
});

const markerIcons = {
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

const markerIconCharacters = {
    circle: "●",
    rectangle: "◼",
    cross: "✕",
    plus: "+"
}

class Dashboard {

    constructor(map, container) {
        this.map = map;
        this.headerContainer = null;
        this.mapTitle = null;
        this.container = container;
        this.layersContainer = null;
        this.searchbarContainer = null;
    }

    inflateHeader() {
        var self = this;

        if (this.headerContainer == null) {
            this.headerContainer = create(this.container, "div");
        } else {
            this.headerContainer.innerHTML = "";
        }

        const mapTitleContainer = create(this.headerContainer, "div", "map-title-container");
        const mapsButton = create(mapTitleContainer, "a", "link-hidden");
        mapsButton.href = "../maps";
        create(mapsButton, "i", "ri-map-2-line");
        this.mapTitle = create(mapTitleContainer, "div", "map-title");
        this.mapTitle.textContent = this.map.title;
        this.mapTitle.addEventListener("click", () => {
            self.inflateMapTitleEdit();
        });

        const refsContainerTemplate = document.getElementById("template-refs");
        if (refsContainerTemplate != null) {
            const node = document.importNode(refsContainerTemplate.content, true);
            this.headerContainer.appendChild(node);
        }
    }

    inflateMapTitleEdit() {
        var self = this;
        let form = create(null, "form");
        let input = create(form, "input", "map-title-input");
        input.value = this.map.title;
        this.mapTitle.replaceWith(form);
        this.mapTitle = form;
        input.focus();
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            let newTitle = input.value.trim();
            if (newTitle != "") {
                self.map.setTitle(newTitle);
                self.inflateHeader();
            }
        });
    }

    inflateSearchBar(container) {
        this.searchbarContainer = create(container, "div", "map-searchbar");
        let searchForm = create(this.searchbarContainer, "form", "form-inline");
        let searchInput = create(searchForm, "input");
        searchInput.type = "text";
        searchInput.placeholder = "Search";
        let searchButton = create(searchForm, "button");
        searchButton.innerHTML = `<i class="ri-search-line"></i>`;
        searchButton.title = "Search";
        var self = this;
        searchForm.addEventListener("submit", (event) => {
            event.preventDefault();
            let query = searchInput.value.trim();
            if (query != "") {
                self.search(query);
            }
        });
    }

    inflateButtons(container) {
        const buttonsContainer = create(container, "div", "map-toolbar");
        var self = this;

        this.map.buttonSave = create(buttonsContainer, "button");
        this.map.buttonSave.innerHTML = `<i class="ri-save-line"></i>`;
        this.map.buttonSave.setAttribute("disabled", true);
        this.map.buttonSave.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.saveData();
        });

        const buttonAddLayer = create(buttonsContainer, "button");
        buttonAddLayer.innerHTML = `<i class="ri-add-line"></i>`;
        buttonAddLayer.title = "Add layer";
        buttonAddLayer.addEventListener("click", () => {
            self.map.addLayer();
        });

        const buttonMarker = create(buttonsContainer, "button");
        buttonMarker.innerHTML = `<i class="ri-map-pin-line"></i>`;
        buttonMarker.title = "Add marker";
        buttonMarker.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.startMarker();
        });
        const buttonPolyline = create(buttonsContainer, "button");
        buttonPolyline.innerHTML = `<i class="ri-route-line"></i>`;
        buttonPolyline.title = "Add polyline";
        buttonPolyline.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.startPolyline();
        });
        const buttonPolygon = create(buttonsContainer, "button");
        buttonPolygon.innerHTML = `<i class="ri-shape-line"></i>`;
        buttonPolygon.title = "Add polygon";
        buttonPolygon.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.startPolygon();
        });
        const buttonToggleEdition = create(buttonsContainer, "button");
        buttonToggleEdition.innerHTML = `<i class="ri-pencil-fill"></i>`;
        buttonToggleEdition.title = "Toggle edition";
        buttonToggleEdition.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.toggleEdition();
            if (self.map.editing) {
                buttonToggleEdition.querySelector("i").className = "ri-close-line";
            } else {
                buttonToggleEdition.querySelector("i").className = "ri-pencil-fill";
            }
        });

        const buttonHome = create(buttonsContainer, "button");
        buttonHome.innerHTML = `<i class="ri-home-line"></i>`;
        buttonHome.title = "Reset view";
        buttonHome.addEventListener("click", (event) => {
            event.stopPropagation();
            self.map.fitViewToFeatures();
        });

        const buttonUserPosition = create(buttonsContainer, "button");
        buttonUserPosition.setAttribute("id", "button-user-position");
        buttonUserPosition.setAttribute("disabled", true);
        buttonUserPosition.innerHTML = `<i class="ri-focus-2-line"></i>`;
        buttonUserPosition.title = "Go to current position";
        buttonUserPosition.addEventListener("click", (event) => {
            event.stopPropagation();
            if (self.map.userPositionWidget != null) {
                self.map.leafletMap.panTo(self.map.userPositionWidget.getLatLng());
            }
        });
    }

    inflateControls() {
        if (this.map.readonly) return;
        const controlsContainer = create(this.container, "div", "map-dashboard-controls");
        this.inflateSearchBar(controlsContainer);
        this.inflateProvider(controlsContainer);
        this.inflateButtons(controlsContainer);
    }

    inflateProvider(container) {
        var self = this;
        const selectBaseMap = create(container, "select", "map-provider-select");
        selectBaseMap.setAttribute("id", "select-base-map");
        PROVIDERS.forEach((provider, i) => {
            let option = create(selectBaseMap, "option");
            option.value = i;
            option.textContent = provider.label;
        });
        selectBaseMap.addEventListener("input", () => {
            let providerIndex = null;
            selectBaseMap.querySelectorAll("option").forEach(option => {
                if (option.selected) providerIndex = parseInt(option.value);
            });
            self.map.setTileLayer(providerIndex);
        });
    }

    inflateCoordinates(container) {
        var self = this;
        let currentCoordinatesLabel = create(container, "div", "map-coordinates");
        currentCoordinatesLabel.style.cursor = "pointer";
        currentCoordinatesLabel.title = "Click to copy";
        function setCurrentCoordinatesLabelText(event) {
            let point = event ? event.latlng : self.map.leafletMap.getCenter();
            currentCoordinatesLabel.textContent = `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
        }
        currentCoordinatesLabel.addEventListener("click", (event) => {
            event.stopPropagation();
            setCurrentCoordinatesLabelText();
            navigator.clipboard.writeText(currentCoordinatesLabel.textContent);
            toast("Coordinates copied to clipboard!", TOAST_SHORT);
        });
        setCurrentCoordinatesLabelText();
        this.map.leafletMap.addEventListener("mousemove", setCurrentCoordinatesLabelText);
    }

    inflateFooter() {
        const footer = create(this.container);
        this.inflateCoordinates(footer);
    }

    inflate() {
        this.inflateHeader();
        this.inflateControls();
        this.layersContainer = create(this.container, "div", "map-layers");
        this.layersContainer.addEventListener("wheel", (event) => {
            event.stopPropagation();
        });
        this.inflateFooter();
    }

    searchNominatim(query) {
        var self = this;
        let url = `https://nominatim.openstreetmap.org/search?q=${encodeURI(query)}&format=jsonv2`;
        fetch(url).then(res => res.json()).then(results => {
            if (results.length == 0) {
                alert("No result found!");
                return;
            }
            //TODO?: handle choice between multiple results
            let bestResult = results[0];
            self.onSearchResult({
                lat: bestResult.lat,
                lon: bestResult.lon,
                label: bestResult.display_name
            });
        });
    }

    onSearchResult(result) {
        let marker = new L.marker([parseFloat(result.lat), parseFloat(result.lon)]);
        this.map.getSelectedLayer().addFeatureFromMapElement(marker, {label: result.label});
        this.map.leafletMap.panTo(marker.getLatLng());
    }

    search(query) {
        if (query.match(/^\d+(\.\d+)? *, *\d+(\.\d+)?$/g)) {
            this.onSearchResult({
                lat: parseFloat(query.split(",")[0]),
                lon: parseFloat(query.split(",")[1]),
                label: "GPS Point"
            });
        } else {
            this.searchNominatim(query);
        }
    }

}


const RESERVERD_PROPERTIES = new Set(["label", "strokeColor", "strokeWidth", "fillColor", "fillOpacity", "markerIcon"]);
const DEFAULT_STROKE_COLOR = "#000000";
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_FILL_COLOR = "#0080ff";
const DEFAULT_FILL_OPACITY = 25;
const DEFAULT_MARKER_ICON = "circle";


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
                this.mapElement.setIcon(markerIcons[style.markerIcon]);
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
                    marker.setIcon(markerIcons[style.markerIcon]);
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

    inflatePopup(container) {
        var self = this;
        container.innerHTML = "";
        const wrapper = create(container, "div", "feature-popup");
        const header = create(wrapper, "div", "feature-popup-header");
        const label = create(header, "span", "feature-label");
        label.textContent = this.properties.label;
        const layerLabel = create(header, "span", "feature-layer-label");
        layerLabel.textContent = this.layer.label;
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
        const buttonEdit = create(buttons, "button");
        buttonEdit.innerHTML = `<i class="ri-pencil-fill"></i>`;
        buttonEdit.title = "Edit";
        buttonEdit.addEventListener("click", (event) => {
            event.stopPropagation();
            self.inflatePopupEdit(container);
        });
        const buttonToggleEdition = create(buttons, "button");
        if (this.geometry.type == "Point") {
            buttonToggleEdition.innerHTML = `<i class="ri-map-pin-line"></i>`;
        } else if (this.geometry.type == "LineString") {
            buttonToggleEdition.innerHTML = `<i class="ri-route-line"></i>`;
        } else {
            buttonToggleEdition.innerHTML = `<i class="ri-shape-line"></i>`;
        }
        if (this.editing) {
            buttonToggleEdition.classList.add("active");
        }
        buttonToggleEdition.title = "Toggle edition";
        buttonToggleEdition.addEventListener("click", (event) => {
            event.stopPropagation();
            if (self.editing) {
                self.disableEdit();
                self.onChange("edit-feature");
            } else {
                self.enableEdit();
            }
            self.layer.map.leafletMap.closePopup();
        });
        const buttonDuplicate = create(buttons, "button");
        buttonDuplicate.innerHTML = `<i class="ri-file-copy-2-line"></i>`;
        buttonDuplicate.title = "Duplicate";
        buttonDuplicate.addEventListener("click", (event) => {
            event.stopPropagation();
            const selfCopy = self.toGeojson();
            selfCopy.properties.label = `${selfCopy.properties.label} (copy)`;
            self.layer.addFeature(selfCopy);
        });
        const buttonMove = create(buttons, "button");
        buttonMove.innerHTML = `<i class="ri-arrow-right-line"></i>`;
        buttonMove.title = "Move";
        buttonMove.addEventListener("click", (event) => {
            event.stopPropagation();
            new MoveFeatureDialog(self.layer.map, self.layer.index, self.index).open();
        });
        const buttonDelete = create(buttons, "button");
        buttonDelete.innerHTML = `<i class="ri-delete-bin-line"></i>`;
        buttonDelete.title = "Delete";
        buttonDelete.addEventListener("click", (event) => {
            event.stopPropagation();
            self.layer.deleteFeature(self.index);
        });
    }

    inflatePopupEdit(container) {
        var self = this;
        container.innerHTML = "";
        const wrapper = create(container, "div", "feature-popup");
        const inputsValues = {};
        const inputsLabels = {};

        const header = create(wrapper, "div", "feature-popup-header");
        
        const labelInput = create(header, "input", "feature-label");
        labelInput.value = this.properties.label;
        inputsValues.label = labelInput;

        const layerLabel = create(header, "span", "feature-layer-label");
        layerLabel.textContent = this.layer.label;

        const table = create(create(wrapper, "div", "feature-properties-wrapper"), "div", "feature-properties");
        const addedPropertiesCounter = 0;
        for (let property in this.properties) {
            if (RESERVERD_PROPERTIES.has(property)) continue;
            let tr = create(table, "div", "feature-property");
            let cellProperty = create(tr, "div", "feature-property-label");
            let inputLabel = create(cellProperty, "input");
            inputLabel.value = property;
            inputsLabels[property] = inputLabel;
            let cellValue = create(tr, "div", "feature-property-value");
            let inputValue = create(cellValue, "input");
            inputValue.value = this.properties[property];
            inputsValues[property] = inputValue;
            let cellButtons = create(tr, "div", "feature-property-buttons");
            let deleteButton = create(cellButtons, "button");
            deleteButton.innerHTML = `<i class="ri-delete-bin-line"></i>`;
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm(`Do you want to delete the property ${property}?`)) {
                    delete inputsValues[property];
                    delete inputsLabels[property];
                    remove(tr);
                }
            });
        }
        let styleForm = create(wrapper, "form", "feature-style");
        let fillColorInput, fillOpacityInput, markerIconSelect;

        const strokeGroup = create(styleForm, "div", "feature-style-group");
        const strokeLabel = create(strokeGroup, "div", "feature-style-label");
        strokeLabel.textContent = "Stroke";
        const strokeInputs = create(strokeGroup, "div", "feature-style-inputs");
        const strokeColorInput = create(strokeInputs, "input", "feature-style-input");
        strokeColorInput.type = "color";
        strokeColorInput.value = this.properties.strokeColor;
        inputsValues["strokeColor"] = strokeColorInput;
        const strokeWidthInput = create(strokeInputs, "input", "feature-style-input");
        strokeWidthInput.type = "number";
        strokeWidthInput.min = "0";
        strokeWidthInput.max = "16";
        strokeWidthInput.step = "1";
        strokeWidthInput.value = this.properties.strokeWidth;
        inputsValues["strokeWidth"] = strokeWidthInput;

        if (this.geometry.type == "Point" || this.geometry.type == "MultiPoint" || this.geometry.type == "Polygon" || this.geometry.type == "MultiPolygon") {
            const fillGroup = create(styleForm, "div", "feature-style-group");
            const fillLabel = create(fillGroup, "div", "feature-style-label");
            fillLabel.textContent = "Fill";
            const fillInputs = create(fillGroup, "div", "feature-style-inputs");
            fillColorInput = create(fillInputs, "input", "feature-style-input");
            fillColorInput.type = "color";
            fillColorInput.value = this.properties.fillColor;
            inputsValues["fillColor"] = fillColorInput;
            if (this.geometry.type == "Polygon" || this.geometry.type == "MultiPolygon") {
                fillOpacityInput = create(fillInputs, "input", "feature-style-input");
                fillOpacityInput.type = "number";
                fillOpacityInput.min = "0";
                fillOpacityInput.max = "100";
                fillOpacityInput.step = "1";
                fillOpacityInput.value = this.properties.fillOpacity;
                inputsValues["fillOpacity"] = fillOpacityInput;
            }
        }
        if (this.geometry.type == "Point" || this.geometry.type == "MultiPoint") {
            //create(styleForm, "span", "feature-style-label").textContent = "Marker icon";
            const markerGroup = create(styleForm, "div", "feature-style-group");
            const markerLabel = create(markerGroup, "div", "feature-style-label");
            markerLabel.textContent = "Marker";
            const markerInputs = create(markerGroup, "div", "feature-style-inputs");
            markerIconSelect = create(markerInputs, "select", "feature-style-input");
            for (const markerIconValue in markerIcons) {
                const option = create(markerIconSelect, "option");
                option.value = markerIconValue;
                option.textContent = markerIconCharacters[markerIconValue];
            }
            markerIconSelect.value = this.properties.markerIcon;
            inputsValues["markerIcon"] = markerIconSelect;
        }
        styleForm.addEventListener("change", () => {
            let customStyle = {
                strokeColor: strokeColorInput ? strokeColorInput.value : self.properties.strokeColor,
                strokeWidth: strokeWidthInput ? strokeWidthInput.value : self.properties.strokeWidth,
                fillColor: fillColorInput ? fillColorInput.value : self.properties.fillColor,
                fillOpacity: fillOpacityInput ? fillOpacityInput.value : self.properties.fillOpacity,
                markerIcon: markerIconSelect ? markerIconSelect.value : self.properties.markerIcon,
            }
            self.setStyle(customStyle);
        });
        let buttons = create(wrapper, "div", "feature-buttons");
        let buttonSave = create(buttons, "button");
        buttonSave.innerHTML = `<i class="ri-save-line"></i>`
        buttonSave.title = "Save";
        buttonSave.addEventListener("click", (event) => {
            event.stopPropagation();
            self.properties = {};
            for (let property in inputsValues) {
                if (property in inputsLabels) {
                    self.properties[inputsLabels[property].value] = inputsValues[property].value;
                } else {
                    self.properties[property] = inputsValues[property].value;
                }
            }
            self.inflate();
            self.onChange("edit-feature");
        });
        let buttonAdd = create(buttons, "button");
        buttonAdd.innerHTML = `<i class="ri-add-line"></i>`
        buttonAdd.title = "Add property";
        buttonAdd.addEventListener("click", (event) => {
            event.stopPropagation();
            addedPropertiesCounter++;
            let property = `Property ${addedPropertiesCounter}`;
            let tr = create(table, "div", "feature-property");
            let cellProperty = create(tr, "div", "feature-property-label");
            let inputLabel = create(cellProperty, "input");
            inputLabel.placeholder = "Label";
            inputLabel.value = "";
            inputsLabels[property] = inputLabel;
            let cellValue = create(tr, "div", "feature-property-value");
            let inputValue = create(cellValue, "input");
            inputValue.placeholder = "Value";
            inputValue.value = "";
            inputsValues[property] = inputValue;
            let cellButtons = create(tr, "div", "feature-property-buttons");
            let deleteButton = create(cellButtons, "button");
            deleteButton.innerHTML = `<i class="ri-delete-bin-line"></i>`;
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm(`Do you want to delete the property ${property}?`)) {
                    delete inputsValues[property];
                    delete inputsLabels[property];
                    remove(tr);
                }
            });
            self.onChange("edit-feature");
        });
        let buttonCancel = create(buttons, "button");
        buttonCancel.innerHTML = `<i class="ri-close-line"></i>`
        buttonCancel.title = "Cancel";
        buttonCancel.addEventListener("click", (event) => {
            event.stopPropagation();
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
        // this.mapElement.addEventListener("popupclose", () => {
        //     try {
        //         self.setStyle();
        //     } catch {
        //         //pass: this may fail if element is being recreated
        //     }
        // });
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

    inflatePanelElement() {
        var self = this;
        if (this.panelElement != null) {
            remove(this.panelElement);
        }
        this.panelElement = create(this.layer.featuresContainer, "li", "map-feature");
        const hasLabel = this.properties.label != undefined && this.properties.label != "";
        create(this.panelElement, "span", "map-feature-label").innerHTML = hasLabel ? this.properties.label : "<i>&lt;null&gt;</i>";
        
        const buttons = create(this.panelElement, "span", "map-feature-buttons");
        
        const moveUp = create(buttons, "button");
        moveUp.innerHTML = `<i class="ri-arrow-up-line"></i>`;
        moveUp.title = "Move up";
        moveUp.addEventListener("click", (event) => {
            event.stopPropagation();
            self.layer.moveFeatureUp(self.index);
        });

        const moveDown = create(buttons, "button");
        moveDown.innerHTML = `<i class="ri-arrow-down-line"></i>`;
        moveDown.title = "Move up";
        moveDown.addEventListener("click", (event) => {
            event.stopPropagation();
            self.layer.moveFeatureDown(self.index);
        });
        
        const moveToAnotherLayerButton = create(buttons, "button");
        moveToAnotherLayerButton.innerHTML = `<i class="ri-arrow-right-line"></i>`;
        moveToAnotherLayerButton.title = "Move to another layer";
        moveToAnotherLayerButton.addEventListener("click", (event) => {
            event.stopPropagation();
            new MoveFeatureDialog(self.layer.map, self.layer.index, self.index).open();
        });
        
        this.panelElement.addEventListener("mouseenter", (event) => {
            self.startHighlight();
        });
        this.panelElement.addEventListener("mouseleave", (event) => {
            self.endHighlight();
        });
        this.panelElement.addEventListener("click", (event) => {
            event.stopPropagation();
            self.goto();
            self.mapElement.openPopup();
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

}


class Layer {

    constructor(map, index, label) {
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
        input.addEventListener("mousedown", stopPropagation);
        input.addEventListener("click", stopPropagation);
        input.addEventListener("dblclick", stopPropagation);
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

    inflate() {
        var self = this;
        if (this.container == null) {
            this.container = create(this.map.dashboard.layersContainer, "div", "map-layer");
            this.container.addEventListener("click", () => {
                self.map.selectLayer(self.index);
            });
            this.featureGroup = L.featureGroup();
            this.featureGroup.addTo(this.map.leafletMap);
            this.featureGroup.setZIndex(this.index);
        }
        this.container.innerHTML = "";

        const summary = create(this.container, "div", "map-layer-summary");

        this.toggle = create(summary, "span", "map-layer-toggle");
        this.toggle.innerHTML = `<svg viewBox="0 0 64 64"><path d="M 6.5 9 L 51.6 32 L 6.5 54.9 L 6.5 9" stroke-width="inherit" stroke="inherit" fill="inherit"/></svg>`
        this.toggle.addEventListener("click", () => {
            self.container.classList.toggle("open");
        });

        const labelContainer = create(summary, "span", "map-layer-label");

        this.labelElement = create(labelContainer, "span", "map-layer-title");
        this.labelElement.textContent = this.label;
        this.labelElement.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
        });

        this.counterLabel = create(labelContainer, "span", "map-layer-count");
        this.counterLabel.textContent = `(${this.features.length})`;

        this.visibilityCheckbox = create(summary, "i", "map-layer-visible ri-eye-line");
        this.visibilityCheckbox.addEventListener("click", () => {
            self.toggleVisibility();
        });
        
        this.setLayerStyleHint();

        if (!this.map.readonly) {
            const buttonsDropdown = create(summary, "span", "dropdown");

            const moreButton = create(buttonsDropdown, "a", "button-inline dropdown-toggle");
            moreButton.innerHTML = ` <i class="ri-more-2-fill"></i>`;
            moreButton.tabIndex = 0;
            
            const buttonsMenu = create(buttonsDropdown, "ul", "menu");
            
            const renameButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            renameButton.innerHTML = `<i class="ri-input-field"></i> Rename layer`;
            renameButton.title = "Rename layer";
            renameButton.addEventListener("click", (event) => {
                event.stopPropagation();
                self.inflateLabelEdit();
            });

            const moveUpButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            moveUpButton.innerHTML = `<i class="ri-arrow-up-line"></i> Move up`;
            moveUpButton.title = "Move up";
            moveUpButton.addEventListener("click", (event) => {
                event.stopPropagation();
                self.map.moveLayerUp(self.index);
            });

            const moveDownButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            moveDownButton.innerHTML = `<i class="ri-arrow-down-line"></i> Move down`;
            moveDownButton.title = "Move down";
            moveDownButton.addEventListener("click", (event) => {
                event.stopPropagation();
                self.map.moveLayerDown(self.index);
            });

            const labelButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            labelButton.innerHTML = `<i class="ri-pencil-fill"></i> Set labels`;
            labelButton.title = "Set feature labels";
            labelButton.addEventListener("click", (event) => {
                event.stopPropagation();
                const propertyName = prompt("Provide the property name to use as label. Probably 'name' or 'title'.");
                if (propertyName == null || propertyName == "") return;
                for (const feature of this.features) {
                    feature.setLabelFromProperty(propertyName);
                }
            });

            const sortButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            sortButton.innerHTML = `<i class="ri-arrow-down-line"></i> Sort features`;
            sortButton.title = "Sort features";
            sortButton.addEventListener("click", (event) => {
                event.stopPropagation();
                let propertyName = prompt("Provide the property name to use as key. Start with a minus to sort in decreasing order.", "label");
                if (propertyName == null || propertyName == "") return;
                let decreasing = false;
                if (propertyName.startsWith("-")) {
                    decreasing = true;
                    propertyName = propertyName.slice(1);
                }
                const r = decreasing ? -1 : 1;
                self.features.sort((a, b) => { return a.properties[propertyName] <= b.properties[propertyName] ? -r : r});
                for (let i = 0; i < self.features.length; i++) {
                    self.features[i].index = i;
                }
                self.inflate();
            });

            const editButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            editButton.innerHTML = `<i class="ri-paint-fill"></i> Edit style`;
            editButton.title = "Edit style";
            editButton.addEventListener("click", (event) => {
                event.stopPropagation();
                self.map.selectLayer(self.index);
                self.map.openLayerStyleDialog();
            });

            const importButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            importButton.innerHTML = `<i class="ri-upload-line"></i> Import GeoJson`;
            importButton.title = "Import GeoJson";
            importButton.addEventListener("click", (event) => {
                event.stopPropagation();
                self.map.selectLayer(self.index);
                self.map.openImportDialog();
            });

            const exportButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            exportButton.innerHTML = `<i class="ri-download-line"></i> Export to GeoJson`;
            exportButton.title = "Export to GeoJson";
            exportButton.addEventListener("click", (event) => {
                event.stopPropagation();
                self.map.selectLayer(self.index);
                self.exportToGeojson();
            });

            const deleteButton = create(create(buttonsMenu, "li", "menu-item"), "button");
            deleteButton.innerHTML = `<i class="ri-delete-bin-line"></i> Delete`;
            deleteButton.title = "Delete";
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();
                if (confirm(`Are you sure to delete "${self.label}"?`)) {
                    self.map.deleteLayer(self.index);
                }
            });

            bindDropdown(buttonsDropdown);
        }

        this.featuresContainer = create(this.container, "ul", "map-features");
        this.features.forEach(feature => {
            feature.inflate();
        });
        if (this.map.readonly) return;

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
        this.addFeature(geojsonData);
    }

    enableEdit() {
        if (!this.visibilityCheckbox.checked) return;
        this.features.forEach(feature => feature.enableEdit());
    }

    disableEdit() {
        if (!this.visibilityCheckbox.checked) return;
        this.features.forEach(feature => feature.disableEdit());
    }

    toggleVisibility() {
        let wasVisible = this.visibilityCheckbox.classList.contains("ri-eye-line");
        if (wasVisible) {
            this.visibilityCheckbox.classList.remove("ri-eye-line");
            this.visibilityCheckbox.classList.add("ri-eye-off-line");
        } else {
            this.visibilityCheckbox.classList.add("ri-eye-line");
            this.visibilityCheckbox.classList.remove("ri-eye-off-line");
        }
        let visible = !wasVisible;
        this.features.forEach(feature => {
            if (visible) {
                feature.inflateMapElement();
            } else {
                feature.mapElement.remove();
                feature.mapElement = null;
            }
        });
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
        }
    }

    exportToGeojson() {
        let geojsonData = this.toGeojson();
        let geojsonString = JSON.stringify(geojsonData);
        let link = document.createElement("a");
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

}

function swapSibling(node2, node1) {
    node1.parentNode.replaceChild(node1, node2);
    node1.parentNode.insertBefore(node2, node1);
}

class Map {

    constructor(objectId, mapLayout, readonly=false) {
        this.objectId = objectId;
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
        this.tileLayer = L.tileLayer(provider.tiles, provider.options);
        this.tileLayer.addTo(this.leafletMap);
    }

    inflateMap() {
        this.leafletMap = L.map(this.container, {
            editable: this.editable,
            zoomControl: false,
        }).setView([46, 2], 6);
        this.leafletMap.on('editable:vertex:ctrlclick editable:vertex:metakeyclick', function (e) {
            e.vertex.continue();
        });
        this.loadTileLayer();
        L.control.zoom({position: "bottomright"}).addTo(this.leafletMap);
        this.dashboard = new Dashboard(this, this.dashboardContainer);
        this.dashboard.inflate();
    }

    fitViewToFeatures() {
        let features = [];
        this.layers.forEach(layer => {
            layer.features.forEach(feature => {
                features.push(feature.mapElement);
            });
        });
        if (features.length === 0) return;
        let group = new L.featureGroup(features);
        this.leafletMap.fitBounds(group.getBounds());
    }

    inflate() {
        this.container.innerHTML = "";
        this.container.classList.add("map-container");
        this.inflateMap();
        this.layers.forEach(layer => {
            layer.inflate();
        });
    }

    setUserPosition(position) {
        //@see https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API/Using_the_Geolocation_API
        if (this.userPositionWidget == null) {
            this.userPositionWidget = new L.Marker(
                [position.coords.latitude, position.coords.longitude],
                {icon: crosshairIcon}
            );
            this.userPositionWidget.addTo(this.leafletMap);
            document.getElementById("button-user-position").removeAttribute("disabled");
        }
        this.userPositionWidget.setLatLng(new L.LatLng(position.coords.latitude, position.coords.longitude));
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
                this.addLayer();
                this.addGeojsonFromData(layerData, true);
            });
            this.fitViewToFeatures();
        }
        if (this.buttonSave != null) {
            this.buttonSave.disabled = true;
        }
        if ("geolocation" in navigator) {
            var self = this;
            navigator.geolocation.getCurrentPosition((position) => {self.setUserPosition(position)});
            navigator.geolocation.watchPosition((position) => {self.setUserPosition(position)});
        } else {
            console.log("Geolocation not available, skipping");
        }
    }

    addLayer() {
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
        let layer = new Layer(this, this.layers.length, label);
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
        swapSibling(this.layers[layerIndex - 1].container, this.layers[layerIndex].container);
        this.resetZIndices();
        this.onChange("layer-order");
    }

    moveLayerDown(layerIndex) {
        if (layerIndex >= this.layers.length - 1) return;
        [this.layers[layerIndex + 1], this.layers[layerIndex]] = [this.layers[layerIndex], this.layers[layerIndex + 1]];
        this.layers[layerIndex + 1].index++;
        this.layers[layerIndex].index--;
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

    toggleEdition() {
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

    toGeojson() {
        let layerArray = [];
        this.layers.forEach(layer => {
            layerArray.push(layer.toGeojson());
        });
        return layerArray;
    }

    setTitle(newTitle) {
        if (this.readonly) return;
        this.title = newTitle;
        this.onChange("edit-map");
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
        apiPost("save-map",
            {
                objectId: this.objectId,
                "title": mapExport.title,
                "geojson": mapExport.geojson,
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
        this.element = create(document.body, "div", "dialog");
        this.overlay = create(this.element, "span", "dialog-overlay");
        this.overlay.addEventListener("click", () => { self.close(); });
        this.container = create(this.element, "div", "dialog-container card");
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
        let title = create(this.container, "div", "dialog-title");
        title.textContent = "Import GeoJson";
        let form = create(this.container, "form");
        let input = create(create(form, "p"), "input");
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
        const buttonsContainer = create(form, "div", "row");
        let importAdd = create(buttonsContainer, "input", "button button-primary");
        importAdd.type = "submit";
        importAdd.name = "add";
        importAdd.value = "Add";
        let importReplace = create(buttonsContainer, "input", "button button-primary");
        importReplace.type = "submit";
        importReplace.name = "replace";
        importReplace.value = "Replace";
        let cancelButton = create(buttonsContainer, "button");
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
        let title = create(this.container, "div", "dialog-title");
        title.textContent = "Edit Layer Style";
        const styleForm = create(this.container, "form", "layer-style");

        let layer = this.map.getSelectedLayer();

        const strokeGroup = create(styleForm, "div", "feature-style-group");
        const strokeLabel = create(strokeGroup, "div", "feature-style-label");
        strokeLabel.textContent = "Stroke";
        const strokeInputs = create(strokeGroup, "div", "feature-style-inputs");
        const strokeColorInput = create(strokeInputs, "input", "feature-style-input");
        strokeColorInput.type = "color";
        strokeColorInput.value = orDefault(layer.mostCommonPropertyValue("strokeColor"), DEFAULT_STROKE_COLOR);
        const strokeWidthInput = create(strokeInputs, "input", "feature-style-input");
        strokeWidthInput.type = "number";
        strokeWidthInput.min = "0";
        strokeWidthInput.max = "16";
        strokeWidthInput.step = "1";
        strokeWidthInput.value = orDefault(layer.mostCommonPropertyValue("strokeWidth"), DEFAULT_STROKE_WIDTH);

        const fillGroup = create(styleForm, "div", "feature-style-group");
        const fillLabel = create(fillGroup, "div", "feature-style-label");
        fillLabel.textContent = "Fill";
        const fillInputs = create(fillGroup, "div", "feature-style-inputs");
        const fillColorInput = create(fillInputs, "input", "feature-style-input");
        fillColorInput.type = "color";
        fillColorInput.value = orDefault(layer.mostCommonPropertyValue("fillColor"), DEFAULT_FILL_COLOR);
        const fillOpacityInput = create(fillInputs, "input", "feature-style-input");
        fillOpacityInput.type = "number";
        fillOpacityInput.min = "0";
        fillOpacityInput.max = "100";
        fillOpacityInput.step = "1";
        fillOpacityInput.value = orDefault(layer.mostCommonPropertyValue("fillOpacity"), DEFAULT_FILL_OPACITY);

        const markerGroup = create(styleForm, "div", "feature-style-group");
        const markerLabel = create(markerGroup, "div", "feature-style-label");
        markerLabel.textContent = "Marker";
        const markerInputs = create(markerGroup, "div", "feature-style-inputs");
        const markerIconSelect = create(markerInputs, "select", "feature-style-input");
        for (const markerIconValue in markerIcons) {
            const option = create(markerIconSelect, "option");
            option.value = markerIconValue;
            option.textContent = markerIconCharacters[markerIconValue];
        }
        markerIconSelect.value = orDefault(layer.mostCommonPropertyValue("markerIcon"), DEFAULT_MARKER_ICON);

        styleForm.addEventListener("submit", (event) => {
            
        });

        const buttons = create(this.container, "div", "row");
        const saveButton = create(buttons, "button", "button-primary");
        saveButton.textContent = "Save";
        saveButton.addEventListener("click", (event) => {
            event.preventDefault();
            let strokeColor = strokeColorInput.value;
            let strokeWidth = strokeWidthInput.value;
            let fillColor = fillColorInput.value;
            let fillOpacity = fillOpacityInput.value;
            let markerIcon = markerIconSelect.value;
            layer.features.forEach(f => {
                f.properties.strokeColor = strokeColor;
                f.properties.strokeWidth = strokeWidth;
                f.properties.fillColor = fillColor;
                f.properties.fillOpacity = fillOpacity;
                f.properties.markerIcon = markerIcon;
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
        let title = create(this.container, "div", "dialog-title");
        title.textContent = "Move Feature to another Layer";
        let form = create(this.container, "form");
        form.style.flexDirection = "column";
        let group = create(form, "p");
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
        let buttons = create(form, "div", "row");
        let moveButton = create(buttons, "button", "button-primary");
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


function initializeMap(mapLayout, readonly) {
    var map = null;
    let mapId = mapLayout.getAttribute("map-id");
    fetch(URL_API + `?action=map&objectId=${mapId}`, {
        method: "get",
        })
        .then(res => res.json())
        .then(mapData => {
            map = new Map(mapId, mapLayout, readonly);
            let geojson = null;
            if (mapData.geojson != null && mapData.geojson.trim() != "") {
                geojson = JSON.parse(mapData.geojson);
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
