var DRAG_RANK_LISTENERS = [];

function dragrank_clear(dragid=null) {
    let indices_to_remove = [];
    DRAG_RANK_LISTENERS.forEach((listener, i) => {
        if (dragid == null || listener.dragid == dragid) {
            document.removeEventListener(listener.type, listener.handler);
            indices_to_remove.push(i);
        }
    });
    for (let j = indices_to_remove.length - 1; j >= 0; j--) {
        DRAG_RANK_LISTENERS.splice(DRAG_RANK_LISTENERS[j], 1);
    }
}

function dragrank(container, element_selector, callback, options={}) {
    
    if (!("zIndex" in options)) options.zIndex = 0;
    if (!("transition" in options)) options.transition = ".3s ease";
    if (!("dragid" in options)) options.dragid = "default";
    if (!("drag_allowed" in options)) options.drag_allowed = () => { return true; };
    if (!("dom_reorder" in options)) options.dom_reorder = false;
    var dragging = null;
    var elements = container.querySelectorAll(element_selector);
    var heights = [];
    var tops = [];
    var margin = null;
    var prev_ordering = [];
    var ordering = [];
    
    function reset_positions() {
        if (heights.length == 0) return;

        let ordering_reversed = [...ordering];
        for (let i = 0; i < elements.length; i++) {
            ordering_reversed[ordering[i]] = i;
        }

        let y = tops[0];
        for (let i = 0; i < elements.length; i++) {
            let j = ordering_reversed[i];
            if (dragging == null || dragging.i != j) {
                elements[j].style.top = (y - tops[j]) + "px";
            }
            y += heights[j];
        }

    }

    function reset_variables() {
        elements = container.querySelectorAll(element_selector);
        heights = [];
        tops = [];
        margin = null;
        prev_ordering = [];
        ordering = [];

        elements.forEach((element, i) => {
            ordering.push(i);
            element.style.cursor = "grab";
            element.style.position = "relative";
            element.style.zIndex = options.zIndex;
            element.style.transition = options.transition;
            element.style.top = 0;
            element.addEventListener("mousedown", (event) => {
                if (options.drag_allowed(element)) {
                    event.stopPropagation();
                    if (heights.length == 0) {
                        let top0 = null;
                        elements.forEach(e => {
                            let bounds = e.getBoundingClientRect();
                            let style = e.currentStyle || window.getComputedStyle(e);
                            if (margin == null) {
                                margin = parseFloat(style.marginBottom.replace("px", ""));
                            }
                            heights.push(bounds.height + margin);
                            if (top0 == null) top0 = bounds.top;
                            tops.push(bounds.top - top0);
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
                        top: parseFloat(element.style.top.replace("px", "")),
                    };
                    element.style.cursor = "grabbing";
                    element.style.zIndex = options.zIndex + 1;
                    element.style.transition = "none";
                    return false;
                }
            });
        });
    
        prev_ordering = [...ordering];
    }

    reset_variables();    

    function update(event) {
        if (dragging == null) return;
        let dx = event.clientX - dragging.x;
        let dy = event.clientY - dragging.y + (window.scrollY - dragging.s);
        dragging.e.style.top = (dragging.top + dy) + "px";
        dragging.e.style.left = dx + "px";

        let ordering_reversed = [...ordering];
        for (let i = 0; i < elements.length; i++) {
            ordering_reversed[ordering[i]] = i;
        }

        let cy = tops[dragging.i] + dragging.top + dy + heights[dragging.i] / 2;
        let y = 0;
        let min_j = null;
        let min_distance = null;
        let czs = [];
        for (let j = 0; j < elements.length; j++) {
            let k = ordering_reversed[j];
            let cz = y + heights[k] / 2;
            let distance = Math.abs(cz - cy);
            if (min_distance == null || distance < min_distance) {
                min_j = j;
                min_distance = distance;
            }
            y += heights[k];
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

    function swap_sibling(node2, node1) {
        node1.parentNode.replaceChild(node1, node2);
        node1.parentNode.insertBefore(node2, node1);
    }

    function dom_reorder() {
        let order_reciprocal = [];
        let current_indices = [];
        for (let i = 0; i < ordering.length; i++) {
            order_reciprocal.push(null);
            current_indices.push(i);
        }
        for (let i = 0; i < ordering.length; i++) {
            order_reciprocal[ordering[i]] = i;
        }
        order_reciprocal.forEach((current_index, target_index) =>  {
            for (let i = current_index; i > target_index; i--) {
                swap_sibling(elements[current_index], elements[current_index].previousElementSibling);
            }
        });
        reset_variables();
        reset_positions();
    }

    function on_mouseup(event) {
        if (dragging == null) return;
        event.stopPropagation();
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
        if (options.dom_reorder) {
            // Timeout to let the animation happen
            setTimeout(dom_reorder, 100);
        }
        prev_ordering = [...ordering];
        return false;
    }

    document.addEventListener("mousemove", update);
    document.addEventListener("wheel", update);
    document.addEventListener("mouseup", on_mouseup);

    DRAG_RANK_LISTENERS.push({dragid: options.dragid, type: "mousemove", handler: update});
    DRAG_RANK_LISTENERS.push({dragid: options.dragid, type: "wheel", handler: update});
    DRAG_RANK_LISTENERS.push({dragid: options.dragid, type: "mouseup", handler: on_mouseup});

    reset_positions();

}

function reorder(array, permutation) {
    let cpy = [...array];
    for (let i = 0; i < array.length; i++) {
        array[permutation[i]] = cpy[i];
    }
}