import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import GObject from 'gi://GObject';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Utils from './utils.js';

// icon names
export const ICON_REFRESH = 'view-refresh-symbolic';
export const ICON_SETTINGS = 'emblem-system-symbolic';
export const ICON_NOTRECORDING = 'alarm-symbolic';
export const ICON_RECORDING = 'appointment-missed-symbolic';
export const ICON_NONSTARRED = 'non-starred-symbolic';
export const ICON_STARRED = 'starred-symbolic';
export const ICON_PLUS = 'list-add-symbolic';

const ICON_WINDOWCLOSE = 'window-close-symbolic';
const ICON_TRIANGLE_CLOSED = 'pan-end-symbolic';
const ICON_TRIANGLE_OPENED = 'pan-down-symbolic';

export const ButtonsItem = GObject.registerClass(
class ButtonsItem extends PopupMenu.PopupBaseMenuItem {
    constructor(iconButtons) {
        super({activate: false});
        this._hbox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.END,
            x_expand: true,
        });
        this.add_child(this._hbox);

        iconButtons.forEach(icon => {
            const btn = new St.Button({
                reactive: true,
                can_focus: true,
                track_hover: true,
                style_class: 'popup-menu-icon',
                child: new St.Icon({
                    icon_name: icon.name,
                    style_class: 'popup-menu-icon',
                }),
            });

            btn.connect('clicked', icon.cb);
            this.add_child(btn);
        });
    }
});

export const LoadMoreItem = GObject.registerClass(
class LoadMoreItem extends PopupMenu.PopupBaseMenuItem {
    constructor(cb, _params) {
        super({
            style_class: 'common-issue-item',
            activate: false,
        });
        this.btn = new St.Button({
            reactive: true,
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            can_focus: true,
            track_hover: true,
            style_class: 'popup-button',
        });
        this.label = new St.Label({text: '...'});
        this.btn.child = this.label;
        this.add_child(this.btn);

        this.btn.connect('clicked', cb);
    }
});

export const CommonItem = GObject.registerClass({
    Signals: {
        'record': {param_types: [GObject.TYPE_BOOLEAN]},
        'favorite': {param_types: [GObject.TYPE_BOOLEAN]},
    },
}, class CommonItem extends PopupMenu.PopupBaseMenuItem {
    constructor(dataitem) {
        super({
            style_class: 'common-issue-item',
            activate: false,
        });

        this._id = dataitem.id;
        this._size_char = 0;

        // hide ornament
        this.setOrnament(PopupMenu.Ornament.HIDDEN);

        // add label issue id
        this._label_id = new St.Label({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });


        // could not find a way to get size of char, so for now get size of '#'
        this._label_id.set_text('#');
        this._size_char = this._label_id.get_width();
        this._label_id.set_text(`#${dataitem.id}`);

        // add subject button
        this._btn_subject = new St.Button({
            reactive: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            can_focus: true,
            track_hover: true,
            style_class: 'popup-button',
        });
        // open url on subject cb
        this._btn_subject.connect('clicked', () => {
            Util.spawn(['xdg-open', dataitem.url]);
        });

        // add record button
        this._recording = false;
        this._btn_record = new StButtonSwitchIcon(
            {
                x_align: Clutter.ActorAlign.END,
                reactive: true,
                can_focus: true,
                track_hover: true,
                style_class: 'popup-menu-icon',
            },
            ICON_NOTRECORDING, ICON_RECORDING);

        this._btn_record.connect('switch', (_btn, state) => {
            this.emit('record', state);
        });

        // add pinned button
        this._btn_pinned = new StButtonSwitchIcon(
            {
                x_align: Clutter.ActorAlign.END,
                reactive: true,
                can_focus: true,
                track_hover: true,
                style_class: 'popup-menu-icon',
            },
            ICON_NONSTARRED, ICON_STARRED);
        this._btn_pinned.connect('switch', (_btn, state) => {
            this.emit('favorite', state);
        });

        CommonItem.prototype.refresh.call(this, dataitem);

        this.add_child(this._label_id);
        this.add_child(this._btn_subject);
        this.add_child(this._btn_record);
        this.add_child(this._btn_pinned);
    }

    pinned(state) {
        this._btn_pinned.set(state);
    }

    record(state) {
        this._btn_record.set(state);
    }

    is_recording() {
        return this._btn_record.state;
    }

    is_favorite() {
        return this._btn_pinned.state;
    }

    refresh(dataitem) {
        this._label_id.set_width(this._size_char * (dataitem.size_issue + 1) + 1);
        this._label_id.visible = dataitem.showid;
        this._btn_subject.set_label(dataitem.subject);
        this._btn_subject.add_style_class_name('popup-menu-item-open');
    }
});

export const IssueItem = GObject.registerClass(
class IssueItem extends CommonItem {
});

export const ProjectItem = GObject.registerClass(
class ProjectItem extends CommonItem {
});

const StButtonSwitchIcon = GObject.registerClass({
    Signals: {
        'switch': {param_types: [GObject.TYPE_BOOLEAN]},
    },
}, class StButtonSwitchIcon extends St.Button {
    constructor(params, icon_off, icon_on) {
        super(params);

        this._state_on = false;
        this._icon_on = icon_on;
        this._icon_off = icon_off;
        this.child = new St.Icon({
            icon_name: icon_off,
            style_class: 'popup-menu-icon',
        });

        this.connect('clicked', () => {
            this.set(!this._state_on);
            this.switch();
        });
    }

    switch() {
        this.emit('switch', this._state_on);
    }

    set(state) {
        this._state_on = state;
        this.child.icon_name = this._state_on ? this._icon_on : this._icon_off;
    }

    get state() {
        return this._state_on;
    }
});

const RecordItem = GObject.registerClass({}, class RecordItem extends CommonItem {
    constructor(dataitem, activities) {
        super(dataitem);

        this.activities = activities;
        this.activity = dataitem.time_entry_activities[0].name;

        this.box_activity = new St.BoxLayout({
            x_align: Clutter.ActorAlign.END,
        });
        this.btn_activity = new St.Button({
            reactive: true,
            x_align: Clutter.ActorAlign.END,
            can_focus: true,
            track_hover: true,
            style_class: 'popup-button',
            label: this.activity,
        });
        this.btn_activity.add_style_class_name('button-activity');
        this.btn_triangle = new St.Button({
            reactive: true,
            x_align: Clutter.ActorAlign.END,
            can_focus: true,
            track_hover: true,
            style_class: 'popup-menu-icon',
            child: new St.Icon({
                icon_name: ICON_TRIANGLE_CLOSED,
                style_class: 'popup-menu-icon',
            }),
        });
        this.btn_triangle.pivot_point = new Graphene.Point({x: 0.5, y: 0.6});
        this.btn_triangle.add_style_class_name('button-triangle');



        this.time_entry = new St.Entry({
            style_class: 'time-entry',
            reactive: true,
            can_focus: true,
            track_hover: true,
            y_align: Clutter.ActorAlign.CENTER,
            x_align: Clutter.ActorAlign.END,
        });

        this.btn_close = new St.Button({
            reactive: true,
            x_align: Clutter.ActorAlign.END,
            can_focus: true,
            track_hover: true,
            style_class: 'popup-menu-icon',
            child: new St.Icon({
                icon_name: ICON_WINDOWCLOSE,
                style_class: 'popup-menu-icon',
            }),
        });

        this.add_child(this.box_activity);
        this.box_activity.add_child(this.btn_activity);
        this.box_activity.add_child(this.btn_triangle);
        this.add_child(this.time_entry);
        this.add_child(this.btn_close);
    }
});

class ActivityItem extends PopupMenu.PopupMenuSection {
    constructor(dataitem, params) {
        super('', params);

        let item;
        let cpt = 0;
        dataitem.time_entry_activities.forEach(activity => {
            if (cpt % 3 === 0) {
                item = new PopupMenu.PopupMenuItem('', {style_class: 'popup-activities'});
                item.setOrnament(PopupMenu.Ornament.HIDDEN);
                this.addMenuItem(item);
            }
            let btn = new St.Button({
                reactive: true,
                x_expand: true,
                can_focus: true,
                track_hover: true,
                style_class: 'popup-button',
            });
            let lab = new St.Label({
                text: activity.name,
            });

            btn.child = lab;

            btn.connect('clicked', () => {
                this.emit('activity', activity.name);
                this.hide();
            });


            item.add_child(btn);
            cpt++;
        });

        this.btn_plus = new St.Button({
            reactive: true,
            x_align: Clutter.ActorAlign.START,
            x_expand: true,
            can_focus: true,
            track_hover: true,
            style_class: 'popup-menu-icon',
            child: new St.Icon({
                icon_name: ICON_PLUS,
                style_class: 'popup-menu-icon',
            }),
        });
        this.btn_plus.connect('clicked', () => {
            this.hide();
        });

        item.add_child(this.btn_plus);

        this.hide();
    }

    show() {
        this.visible = true;
        this._getMenuItems().forEach(item => {
            item.show();
        });
    }

    hide() {
        this.visible = false;
        this._getMenuItems().forEach(item => {
            item.hide();
        });
    }
}

export const RecordActivityItem = GObject.registerClass({
    Signals: {
        'record': {param_types: [GObject.TYPE_BOOLEAN]},
        'delete': {},
        'activity': {param_types: [GObject.TYPE_STRING]},
        'new-time': {param_types: [GObject.TYPE_FLOAT]},
        'new-record': {},
    },
}, class RecordActivityItem extends GObject.Object {
    constructor(menu, dataitem) {
        super();
        this.menu = menu;
        this.record = new RecordItem(dataitem);
        this.menu.addMenuItem(this.record);
        this.activities = new ActivityItem(dataitem);
        this.menu.addMenuItem(this.activities);

        // init time entry
        this.set_time(0);

        // connect signals
        this.record.btn_activity.connect('clicked', () => this.activities_hide_show());
        this.record.btn_triangle.connect('clicked', () => this.activities_hide_show());
        this.record.btn_close.connect('clicked', () => this.emit('delete'));
        this.record.connect('record', (item_, state) => this.emit('record', state));
        this.activities.connect('activity', (_btn, activity) => this.emit('activity', activity));
        this.record.time_entry.get_clutter_text().connect('activate', text => this._newtime_cb(text.get_text()));
        this.activities.btn_plus.connect('clicked', () => this.emit('new-record'));
    }

    destroy() {
        this.activities.destroy();
        this.record.destroy();
    }

    refresh(dataitem) {
        this.record.refresh(dataitem);
        // TODO activities refresh
    }

    set_record(state) {
        this.record.record(state);
    }

    set_activity(activity) {
        this.record.btn_activity.set_label(activity);
    }

    get_time(text) {
        let split = text.split(':');
        let hours = Number(split[0]);
        let minutes = 0;
        if (split.length > 1)
            minutes = Number(split[1]);

        // check if there are numbers
        for (let it of [hours, minutes]) {
            if (isNaN(it)) {
                let msg = `${text} is not valid time, it should be in the form HH:MM`;
                Utils.notify_error(msg);
                throw new Error(msg);
            }
        }
        return hours + minutes / 60;
    }

    set_time(time) {
        this.record.time_entry.set_hint_text(Utils.get_time_hh_mm(time));
        this.record.time_entry.set_text('');
    }

    _newtime_cb(text) {
        this.emit('new-time', this.get_time(text));
    }

    activities_hide_show() {
        if (this.activities.visible) {
            this.record.btn_triangle.set_icon_name(ICON_TRIANGLE_CLOSED);
            this.activities.hide();
        } else {
            this.record.btn_triangle.set_icon_name(ICON_TRIANGLE_OPENED);
            this.activities.show();
        }
    }
});
