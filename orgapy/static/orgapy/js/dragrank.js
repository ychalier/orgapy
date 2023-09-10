function dragrank(container, element_selector, callback, options={}) {
    
    if (!("zIndex" in options)) options.zIndex = 0;
    if (!("transition" in options)) options.transition = ".3s ease";
    var dragging = null;
    var elements = container.querySelectorAll(element_selector);
    var centers = [];
    var prev_ordering = [];
    var ordering = [];
    
    function reset_positions() {
        if (centers.length == 0) return;
        for (let i = 0; i < elements.length; i++) {
            if (dragging != null && dragging.i == i) continue;
            let j = ordering[i];
            elements[i].style.top = (centers[j].y - centers[i].y) + "px";
        }
    }

    elements.forEach((element, i) => {
        ordering.push(i);
        element.style.cursor = "grab";
        element.style.position = "relative";
        element.style.zIndex = options.zIndex;
        element.style.transition = options.transition;
        element.style.top = 0;
        element.addEventListener("mousedown", (event) => {
            if (centers.length == 0) {
                elements.forEach(e => {
                    let bounds = e.getBoundingClientRect();
                    centers.push({
                        x: bounds.left + bounds.width / 2,
                        y: bounds.top + bounds.height / 2,
                    });
                });
            }
            dragging = {
                e: element,
                i: i,
                x: event.clientX,
                y: event.clientY,
                j: ordering[i],
                o: ordering[i],
                s: window.scrollY,
            };
            element.style.cursor = "grabbing";
            element.style.zIndex = options.zIndex + 1;
            element.style.transition = "none";
        });
    });

    prev_ordering = [...ordering];

    function update(event) {
        if (dragging == null) return;
        let dx = event.clientX - dragging.x;
        let dy = event.clientY - dragging.y + (window.scrollY - dragging.s);
        dragging.e.style.top = (centers[dragging.o].y - centers[dragging.i].y + dy) + "px";
        dragging.e.style.left = dx + "px";
        let cy = centers[dragging.o].y + dy;
        let min_j = null;
        let min_distance = null;
        for (let j = 0; j < centers.length; j++) {
            let distance = Math.abs(centers[j].y - cy);
            if (min_distance == null || distance < min_distance) {
                min_j = j;
                min_distance = distance;
            }
        }
        if (min_distance == null) min_j = dragging.j;
        if (min_j != dragging.j) {
            if (min_j > dragging.j) {
                for (let k = 0; k < ordering.length; k++) {
                    if (ordering[k] > dragging.j && ordering[k] <= min_j) {
                        ordering[k] = ordering[k] - 1;
                    } 
                }
            } else {
                for (let k = 0; k < ordering.length; k++) {
                    if (ordering[k] >= min_j && ordering[k] < dragging.j) {
                        ordering[k] = ordering[k] + 1;
                    } 
                }
            }
            ordering[dragging.i] = min_j;
            reset_positions();
        }
        dragging.j = min_j;
    }

    document.addEventListener("mousemove", update);
    document.addEventListener("wheel", update);

    document.addEventListener("mouseup", (event) => {
        if (dragging == null) return;
        dragging.e.style.left = 0;
        dragging.e.style.cursor = "grab";
        dragging.e.style.zIndex = options.zIndex;
        dragging.e.style.transition = options.transition;
        dragging = null;
        reset_positions();
        let permutation = [...ordering];
        let changed = false;
        for (let k = 0; k < ordering.length; k++) {
            permutation[prev_ordering[k]] = ordering[k];
            changed = changed || permutation[k] != k;
        }
        if (changed) callback(ordering, permutation);
        prev_ordering = [...ordering];
    });

    reset_positions();

}

function reorder(array, permutation) {
    let cpy = [...array];
    for (let i = 0; i < array.length; i++) {
        array[permutation[i]] = cpy[i];
    }
}