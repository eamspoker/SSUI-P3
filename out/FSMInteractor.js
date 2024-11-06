//===================================================================
// Finite State Machine driven interactor v1.0a 10/2023
// by Scott Hudson, CMU HCII 
//
// This and accompanying files provides classes and types which implement a generic
// interactor whose appearance and behavior is controlled by a Finite State Machine (FSM), 
// along with a set of "regions" which determine its appearance, as well as how 
// high-level input events for it are synthized and dispatched. See the comments
// in various classes for details.
//
// Revision history
// v1.0a  Initial version                 Scott Hudson  10/23
//
//===================================================================
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { FSM } from "./FSM.js";
import { Err } from "./Err.js";
//===================================================================
// Class for an interactive object controlled by a finite state machine (FSM).
// Objects of this class have a position on the screen (the location of their top-left
// corner within the HTML canvas object associated with thier parent (Root) object), 
// Along with an FSM object which specifies, and partially imlements, their behavior.
// This class is repsonsible for using the FSM object to draw all the current region 
// images within the FSM, and for dispatching events to the FSM to drive its behavior.
// Note that this object has a position, but not an explicit size, and that no clipping
// of its output is being done.  Regions within the FSM are positioned in the coordinate
// system of this object (i.e., WRT its top-left corner), and have a size that 
// establishes a bouding box for input purposes (i.e., indicateing which event positions 
// are considered "inside" or "over" the region for input purposes).  However, region 
// image displays are not not limited to that bounding box and are not clipped (except 
// by the containing HTML canvas object).  See the FSM and Root classes for more details.
//=================================================================== 
export class FSMInteractor {
    constructor(fsm = undefined, x = 0, y = 0, parent) {
        //. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
        // You will need some persistent bookkeeping for dispatchRawEvent()
        // what regions were we in before the raw event was dispatched
        this.previous_regions = [];
        this._fsm = fsm;
        this._x = x;
        this._y = y;
        this._parent = parent;
        if (fsm)
            fsm.parent = this;
    }
    get x() { return this._x; }
    set x(v) {
        // if v is new, we update and pass damage up the tree
        if (!(v === this.x)) {
            this._x = v;
            this.damage();
        }
    }
    get y() { return this._y; }
    set y(v) {
        // if v is new, we update and pass damage up the tree
        if (!(v === this.y)) {
            this._y = v;
            this.damage();
        }
    }
    // Position treated as a single value
    get position() {
        return { x: this.x, y: this.y };
    }
    set position(v) {
        var _a;
        if ((v.x !== this._x) || (v.y !== this._y)) {
            this._x = v.x;
            this._y = v.y;
            (_a = this.parent) === null || _a === void 0 ? void 0 : _a.damage;
        }
    }
    get parent() { return this._parent; }
    set parent(v) {
        var _a, _b;
        // if v is new, we update and pass damage up the tree
        if (!(v === this.parent)) {
            // tell the old parent to redraw
            (_a = this.parent) === null || _a === void 0 ? void 0 : _a.damage();
            this._parent = v;
            // tell new parent to redraw
            (_b = this.parent) === null || _b === void 0 ? void 0 : _b.damage();
        }
    }
    get fsm() { return this._fsm; }
    //-------------------------------------------------------------------
    // Methods
    //-------------------------------------------------------------------
    // Declare that something managed by this object (most typically a region image, 
    // position, or size within the underlying FSM) has changed in a way that may 
    // make the current display incorrect and in need of update.  This is normally called 
    // from the controlling FSM, in response to damage declarations from its  "child" 
    // regions, etc.  This method passes the damage notification to its hosting Root
    // object which coordinates eventual redraw by calling this object's draw() method.
    damage() {
        var _a;
        // if we have a parent, pass damage up the tree
        (_a = this.parent) === null || _a === void 0 ? void 0 : _a.damage();
    }
    //. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
    // Draw the display for this object using the given drawing context object.  If the
    // showDegugging parameter is passed as true, additional drawing for debugging 
    // purposes (e.g., a black frame showing the bounding box of every region) is 
    // requsted.  See Region.draw() for more details.
    draw(ctx, showDebugging = false) {
        // bail out if we don't have an FSM to work from
        if (!this.fsm)
            return;
        // for all of the regions in our FSM...
        this.fsm.regions.forEach(region => {
            ///... save the context, move into the region's coordinate space
            // draw that region,
            // then restore the context to translate to the next coordinate
            // space correctly
            ctx.save();
            ctx.translate(region.x, region.y);
            region.draw(ctx, showDebugging);
            ctx.restore();
        });
    }
    //. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
    // Perform a "pick" operation, to determine the list of regions in our controlling
    // FSM which the given point is to be considered "inside" of or "over" (i.e., that
    // the given point is within the bounding box of).  The position passed here must 
    // be in the local coordinate system of this object (i.e., the position 0,0 would 
    // be at the top-left of this object).  Note that the "pick list" returned here
    // is ordered in reverse regions drawing order (regions drawn later, appear
    // earlier in the list) so that the region drawn on top of other objects appear
    // before them in the list.
    pick(localX, localY) {
        let pickList = [];
        // if we have no FSM, there is nothing to pick
        if (!this.fsm)
            return pickList;
        // for all of the regions in our FSM...
        this.fsm.regions.forEach(region => {
            // check if the region is picked
            // note: we subtract region.x and region.y as
            // region.pick expects coordinates local to the region
            if (region.pick(localX - region.x, localY - region.y)) {
                // unshift places this region at the beginning of the list
                // as we want it in reverse drawing order
                // and this.fsm.regions is in drawing order
                pickList.unshift(region);
            }
        });
        return pickList;
    }
    // Dispatch the given "raw" event by translating it into a series of higher-level
    // events which are formulated in terms of the regions of our FSM.  "Raw" events 
    // are based on simple actions with the input device(s) -- currently just press and
    // release of the first/primary locator button, and locator moves.  "Raw" events are 
    // represented by one of those three event types along with a position (in the local
    // coordinates of this object).  
    //
    // The following higher-level events are generated as translations of a "raw" event:
    // exit <region>, enter <region>, press <region>, move_inside <region>, 
    // release <region>, and release_none.  Multiple of these high level events can be 
    // generated from one "raw" event.  For example, an underlying move event can 
    // generate exit, enter, and move_inside events for multiple regions.  The order
    // of event delivery is to first deliver all exit events, then all enter events, etc.
    // in the order listed above.  Within each event type, events associated with the 
    // last drawn region should be dispatched first (i.e., events are delivered in 
    // reverse region drawing order). Note that all generated higher-level events
    // are dispatched to the FSM (via its actOnEvent() method).
    dispatchRawEvent(what, localX, localY) {
        var _a;
        // if we have no FSM, there is nothing to dispatch to
        if (this.fsm === undefined)
            return;
        if (what == 'move') {
            let current_regions = [];
            // for each region in the fsm...
            this.fsm.regions.forEach(region => {
                var _a, _b, _c;
                // we check if it's picked (e.g. mouse over interactor)...
                let picked = region.pick(localX - region.x, localY - region.y);
                // ... and we checked if, before this event, we were in that region
                let prevIn = this.previous_regions.includes(region);
                if (picked && prevIn) {
                    // if we were already in the region and remained inside 
                    // of it, is a move_inside event
                    (_a = this.fsm) === null || _a === void 0 ? void 0 : _a.actOnEvent('move_inside', region);
                    // unshift places items at the beginning of the list
                    // we use this for reverse drawing order
                    current_regions.unshift(region);
                }
                else if (picked) {
                    // if we weren't previously in the region, but are now
                    // it is an enter event
                    (_b = this.fsm) === null || _b === void 0 ? void 0 : _b.actOnEvent('enter', region);
                    // unshift places items at the beginning of the list
                    // we use this for reverse drawing order
                    current_regions.unshift(region);
                }
                else if (prevIn) {
                    // if we were in the region, but no longer are after
                    // this, we exit the event
                    (_c = this.fsm) === null || _c === void 0 ? void 0 : _c.actOnEvent('exit', region);
                }
            });
            // update regions list for bookkeeping
            this.previous_regions = current_regions;
        }
        else if (what === 'press') {
            // for each region in the fsm...
            this.fsm.regions.forEach(region => {
                var _a;
                // ... checked if it's picked ...
                let picked = region.pick(localX - region.x, localY - region.y);
                if (picked) {
                    // ... if it is, act on it
                    (_a = this.fsm) === null || _a === void 0 ? void 0 : _a.actOnEvent('press', region);
                }
            });
        }
        else {
            // for the release, we still want to act on it even if there's no
            // region underneath, so we keep track of whether we found a region
            // or not
            let hasReleased = false;
            // for each region in the fsm...
            this.fsm.regions.forEach(region => {
                var _a;
                // ... checked if it's picked ...
                let picked = region.pick(localX - region.x, localY - region.y);
                if (picked) {
                    // ... if it is, act on it
                    (_a = this.fsm) === null || _a === void 0 ? void 0 : _a.actOnEvent('release', region);
                    hasReleased = true;
                }
            });
            // if we have not yet released (meaning we didn't find a region)
            // we release_none
            if (!hasReleased) {
                (_a = this.fsm) === null || _a === void 0 ? void 0 : _a.actOnEvent('release_none');
            }
        }
    }
    //. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
    // Method to begin an asychnous load of a FSM_json object from a remotely loaded 
    // .json file.  This object is then transformed into an FSM object to control
    // this object.  This method starts the loading process and sets up follow-on 
    // (asynchonous) actions, but then immediately returns.  In the asynchronous follow-on
    // actios, if the loading fails, Err.emit() is called with an appropriate message, 
    // and this._fsm is set to undefined.  When/if loading completes, the data is 
    // unpacked into an FSM_json object which is in turn used by FSM.fromJson() to create 
    // an FSM object installed as our fsm property.  Finally we declare damage to our 
    // parent object to arrange for redraw with the newly installed FSM.
    startLoadFromJson(jsonLoc) {
        return __awaiter(this, void 0, void 0, function* () {
            // try to load the json text from the given location
            const response = yield fetch(jsonLoc);
            if (!response.ok) {
                Err.emit(`Load of FSM from "${jsonLoc}" failed`);
                this._fsm = undefined;
                return;
            }
            //  parse the json into an (alledged) FSM_json object
            const data = yield response.json();
            // validate and build an actual FSM object out of that
            this._fsm = FSM.fromJson(data, this);
            // we just changed everything, so declare damage
            this.damage();
        });
    }
} // end class FSMInteractor 
//===================================================================
//# sourceMappingURL=FSMInteractor.js.map