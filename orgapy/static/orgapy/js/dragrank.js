var DRAG_RANK_LISTENERS = [];

function dragRankClear(dragid=null) {
    let indicesToRemove = [];
    DRAG_RANK_LISTENERS.forEach((listener, i) => {
        if (dragid == null || listener.dragid == dragid) {
            document.removeEventListener(listener.type, listener.handler);
            indicesToRemove.push(i);
        }
    });
    for (let j = indicesToRemove.length - 1; j >= 0; j--) {
        DRAG_RANK_LISTENERS.splice(DRAG_RANK_LISTENERS[j], 1);
    }
}

function dragRank(container, elementSelector, callback, options={}) {
    if (!("zIndex" in options)) options.zIndex = 0;
    if (!("transition" in options)) options.transition = ".3s ease";
    if (!("dragid" in options)) options.dragid = "default";
    if (!("dragAllowed" in options)) options.dragAllowed = () => { return true; };
    if (!("domReorder" in options)) options.domReorder = false;
    var dragging = null;
    var elements = container.querySelectorAll(elementSelector);
    var heights = [];
    var tops = [];
    var margin = null;
    var prevOrdering = [];
    var ordering = [];
    
    function resetPositions() {
        if (heights.length == 0) return;

        let orderingReversed = [...ordering];
        for (let i = 0; i < elements.length; i++) {
            orderingReversed[ordering[i]] = i;
        }

        let y = tops[0];
        for (let i = 0; i < elements.length; i++) {
            let j = orderingReversed[i];
            if (dragging == null || dragging.i != j) {
                elements[j].style.zIndex = options.zIndex;
                elements[j].style.top = (y - tops[j]) + "px";
            }
            y += heights[j];
        }

    }

    function resetVariables() {
        elements = container.querySelectorAll(elementSelector);
        heights = [];
        tops = [];
        margin = null;
        prevOrdering = [];
        ordering = [];

        elements.forEach((element, i) => {
            ordering.push(i);
            element.style.cursor = "grab";
            element.style.position = "relative";
            element.style.transition = options.transition;
            element.style.top = 0;
            element.addEventListener("mousedown", (event) => {
                if (options.dragAllowed(element)) {
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
    
        prevOrdering = [...ordering];
    }

    resetVariables();    

    function update(event) {
        if (dragging == null) return;
        let dx = event.clientX - dragging.x;
        let dy = event.clientY - dragging.y + (window.scrollY - dragging.s);
        dragging.e.style.top = (dragging.top + dy) + "px";
        dragging.e.style.left = dx + "px";

        let orderingReversed = [...ordering];
        for (let i = 0; i < elements.length; i++) {
            orderingReversed[ordering[i]] = i;
        }

        let cy = tops[dragging.i] + dragging.top + dy + heights[dragging.i] / 2;
        let y = 0;
        let minJ = null;
        let minDistance = null;
        for (let j = 0; j < elements.length; j++) {
            let k = orderingReversed[j];
            let cz = y + heights[k] / 2;
            let distance = Math.abs(cz - cy);
            if (minDistance == null || distance < minDistance) {
                minJ = j;
                minDistance = distance;
            }
            y += heights[k];
        }
        
        if (minDistance == null) minJ = dragging.j;
        if (minJ != dragging.j) {
            if (minJ > dragging.j) {
                for (let k = 0; k < ordering.length; k++) {
                    if (ordering[k] > dragging.j && ordering[k] <= minJ) {
                        ordering[k] = ordering[k] - 1;
                    } 
                }
            } else {
                for (let k = 0; k < ordering.length; k++) {
                    if (ordering[k] >= minJ && ordering[k] < dragging.j) {
                        ordering[k] = ordering[k] + 1;
                    } 
                }
            }
            ordering[dragging.i] = minJ;
            resetPositions();
        }
        dragging.j = minJ;
    }

    function swapSibling(node2, node1) {
        node1.parentNode.replaceChild(node1, node2);
        node1.parentNode.insertBefore(node2, node1);
    }

    function domReorder() {
        let orderReciprocal = [];
        let currentIndices = [];
        for (let i = 0; i < ordering.length; i++) {
            orderReciprocal.push(null);
            currentIndices.push(i);
        }
        for (let i = 0; i < ordering.length; i++) {
            orderReciprocal[ordering[i]] = i;
        }
        orderReciprocal.forEach((current_index, target_index) =>  {
            for (let i = current_index; i > target_index; i--) {
                swapSibling(elements[current_index], elements[current_index].previousElementSibling);
            }
        });
        resetVariables();
        resetPositions();
    }

    function onMouseUp(event) {
        if (dragging == null) return;
        event.stopPropagation();
        dragging.e.style.left = 0;
        dragging.e.style.cursor = "grab";
        dragging.e.style.transition = options.transition;
        dragging = null;
        resetPositions();
        let permutation = [...ordering];
        let changed = false;
        for (let k = 0; k < ordering.length; k++) {
            permutation[prevOrdering[k]] = ordering[k];
            changed = changed || permutation[k] != k;
        }
        if (changed) callback(ordering, permutation);
        if (options.domReorder) {
            // Timeout to let the animation happen
            setTimeout(domReorder, 100);
        }
        prevOrdering = [...ordering];
        return false;
    }

    document.addEventListener("mousemove", update);
    document.addEventListener("wheel", update);
    document.addEventListener("mouseup", onMouseUp);

    DRAG_RANK_LISTENERS.push({dragid: options.dragid, type: "mousemove", handler: update});
    DRAG_RANK_LISTENERS.push({dragid: options.dragid, type: "wheel", handler: update});
    DRAG_RANK_LISTENERS.push({dragid: options.dragid, type: "mouseup", handler: onMouseUp});

    resetPositions();

}

function dragRankReorder(array, permutation) {
    let cpy = [...array];
    for (let i = 0; i < array.length; i++) {
        array[permutation[i]] = cpy[i];
    }
}