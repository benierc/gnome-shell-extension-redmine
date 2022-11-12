import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ApiRedmine} from './apiredmine.js';
import * as Utils from './utils.js';

// minumum times in minutes
const MINIMUM_TIME_TORECORD = 5;
const MINIMUM_RECORD_INTERVAL = 0.1;
// hours
const MINIMUM_TIME_TORECORD_H = MINIMUM_TIME_TORECORD / 60;
const MINIMUM_RECORD_INTERVAL_H = MINIMUM_RECORD_INTERVAL / 60;

const TIME_TOREFRESH = 5;

class DataItem {
    constructor(data) {
        this.refresh(data);
    }

    refresh(data) {
        this.id = data.id;
        this.url = data.url;
        this.subject = data.subject;
        this.time_entry_activities = data.time_entry_activities;
        this.size_issue = data.size_issue;
        this.showid = data.showid;
    }
}

const Record = GObject.registerClass({
    Signals: {
        'record': {param_types: [GObject.TYPE_BOOLEAN]},
        'new-record': {},
        'delete': {},
        'time-updated': {},
    },
}, class Record extends GObject.Object {
    constructor(indicator, apiredmine, dataitem) {
        super();
        this._indicator = indicator;
        this.apiredmine = apiredmine;
        this.dataitem = dataitem;
        this.timeid = null; // null means no time entry created in redmine still
        this.recording = false;
        this._activity = this.dataitem.time_entry_activities[0].name;
        this._time_recorded = 0;
        this._date_start = null;
        this._recorditem = this._indicator.add_record(dataitem);
        this._recorditem.connect('record', (item_, state) => this.record_cb(state));
        this._recorditem.connect('activity', (item_, activity) => this.activity_cb(activity));
        this._recorditem.connect('delete', () => this.delete_cb());
        this._recorditem.connect('new-time', (item_, time) => this.newtime_cb(time));
        this._recorditem.connect('new-record', () => this.emit('new-record'));
    }

    destroy() {
        this._recorditem.destroy();
    }

    async newtime_cb(time) {
        try {
            if (time > 24) {
                Utils.notify_warn(`not recording time=${time}: it is too high`);
                return;
            }

            await this._time_entry(time, 0, true);
        } catch (error) {
            Utils.error(error);
        }
    }

    async activity_cb(activity) {
        try {
            if (this.timeid)
                await this.apiredmine.update_time_entry(this.timeid, null, this.get_activity_id(activity), null);

            this._recorditem.set_activity(activity);
            this._activity = activity;
        } catch (error) {
            Utils.error(error);
        }
    }

    delete_cb() {
        try {
            this.emit('delete');

            if (this.timeid)
                this.apiredmine.delete_time_entry(this.timeid);

            this.destroy();
        } catch (error) {
            Utils.error(error);
        }
    }

    record_cb(state) {
        try {
            this.record(state);
            this.emit('record', state);
        } catch (error) {
            Utils.error(error);
        }
    }

    set_timeid(timeid) {
        this.timeid = timeid;
    }

    set_time_activity(time, activity) {
        this._time_recorded = time;
        this._activity = activity;
        this._recorditem.set_activity(activity);
        this._recorditem.set_time(time);
    }

    record(state) {
        this._recorditem.set_record(state);

        if (state) {
            if (!this._recording) {
                this._date_start = Date.now();
                this._recording = true;
                log(`recording ${this.dataitem.id} '${this.dataitem.subject}'`);
            }
        } else {
            if (this._recording) {
                this.refresh_time();
                log(`stop recording ${this.dataitem.id} '${this.dataitem.subject}'`);
            }
            this._recording = false;
        }
    }

    get_activity_id(activity) {
        for (let itactivity of this.dataitem.time_entry_activities) {
            if (itactivity.name === activity)
                return itactivity.id;
        }

        throw new Error(`Could not find activity id for ${this._activity}`);
    }

    async _create_time_entry(hours) {
        // do not record if no enough time
        if (hours < MINIMUM_TIME_TORECORD_H)
            return;

        // create time entry in redmine
        let issue_id = this.dataitem.showid ? this.dataitem.id : null;
        let project_id = this.dataitem.showid ? null : this.dataitem.id;
        let data = await this.apiredmine.create_time_entry(
            issue_id, project_id, hours,
            this.get_activity_id(this._activity), null, null);
        if (data)
            this.timeid = data.time_entry.id;

        log(`time entry created in redmine ${JSON.stringify(data)}`);
        this.emit('time-updated');
    }

    async _update_time_entry(hours) {
        await this.apiredmine.update_time_entry(this.timeid, hours, null, null);
        log(`time entry updated in redmine hours=${hours} for timeid=${this.timeid}`);
        this._time_recorded = hours;
        this.emit('time-updated');
    }

    async _time_entry(hours, offset, force) {
        if (!this.timeid) {
            this._create_time_entry(hours);
        } else {
            // update time
            let do_update = true;

            // check if recorded time matching redmine time entry
            if (!force) {
                let data = await this.apiredmine.time_entry(this.timeid);

                // if time_entry in redmine differs from saved time_recorded
                if (Math.abs(data.time_entry.hours - this._time_recorded) > 0.0001) {
                    Utils.notify_warn('do not record time for this entry, do not match stored time');

                    hours = data.time_entry.hours;
                    offset = 0;
                    do_update = false;
                }
            }

            if (do_update)
                await this._update_time_entry(offset + hours);
        }

        this._time_recorded = hours + offset;
        if (this.timeid)
            this._date_start = Date.now();
        this._recorditem.set_time(this._time_recorded);
    }

    async refresh_time() {
        if (this._recording) {
            let diffhours = (Date.now() - this._date_start) / (1000 * 3600);

            // ignore diff too low
            if (diffhours < MINIMUM_RECORD_INTERVAL_H) {
                console.warn(`diff=${diffhours} is too low to be updated`);
                return;
            }

            await this._time_entry(diffhours, this._time_recorded, false);
        }
    }

    refresh(dataitem) {
        this.dataitem = dataitem;
        this._recorditem.refresh(dataitem);
        this.refresh_time();
    }
});

const IssueProject = GObject.registerClass({
    Signals: {
        'time-updated': {},
    },
}, class IssueProject extends GObject.Object {
    constructor(indicator, apiredmine, data) {
        super();
        this.apiredmine = apiredmine;
        this._indicator = indicator;
        this.dataitem = new DataItem(this._set_dataitem(data));
        this._mainitem = null;
        this.pinned = false;
        this.recording = false;

        this._records = [];

        this._recorditem = null;
    }

    mainitem(item) {
        if (!this._mainitem) {
            this._mainitem = item;
            this._mainitem.connect('record', (_item, state) => this.record_cb(state));
        }
    }

    get_record(timeid) {
        for (let record of this._records) {
            if (record.timeid === timeid)
                return record;
        }

        return null;
    }

    record(timeid, time, activity) {
        let record = this.get_record(timeid);

        if (!record) {
            record = this.newrecord();
            record.set_timeid(timeid);
        }

        record.set_time_activity(time, activity);
    }

    delete_record(record) {
        log('Delete record');

        // remove from this._records
        let i = this._records.indexOf(record);
        if (i < 0) {
            Utils.notify_error('Cannot find record');
            return;
        }

        this._records.splice(i, 1);

        // unrecord mainitem if needed
        this._mainitem.record(false);
    }

    newrecord() {
        let record = new Record(this._indicator, this.apiredmine, this.dataitem);
        this._records.push(record);
        record.connect('record', (item, state) => this._mainitem.record(state));
        record.connect('delete', rec => this.delete_record(rec));
        record.connect('time-updated', () => this.emit('time-updated'));
        record.connect('new-record', () => this.newrecord());
        return record;
    }

    record_cb(state) {
        if (state) {
            // create record if no one exist
            if (!this._records.length)
                this.newrecord();
        }

        for (let record of this._records)
            record.record(state);
    }

    refresh(data) {
        this.dataitem.refresh(this._set_dataitem(data));

        if (this._mainitem)
            this._mainitem.refresh(this.dataitem);


        for (let record of this._records)
            record.refresh(this.dataitem);
    }
});


const Issue = GObject.registerClass({
}, class Issue extends IssueProject {
    _set_dataitem(data) {
        return {
            'id': data.id,
            'url': `${this.apiredmine.url}/issues/${data.id}`,
            'subject': data.subject,
            'showid': true,
            'time_entry_activities': data.time_entry_activities,
            'size_issue': this.apiredmine.size_issue,
        };
    }
});

const Project = GObject.registerClass({
}, class Project extends IssueProject {
    _set_dataitem(data) {
        return {
            'id': data.id,
            'url': `${this.apiredmine.url}/projects/${data.id}`,
            'subject': data.name,
            'showid': false,
            'time_entry_activities': data.time_entry_activities,
            'size_issue': this.apiredmine.size_issue,
        };
    }
});

export class Manager {
    constructor(extension, indicator) {
        log('init manager');
        this._extension = extension;
        this._indicator = indicator;
        this._settings = extension.getSettings();

        this._mapissues = {};
        this._mapprojects = {};

        this._nb_issues = 10;
        this._record_time = 0;

        this._init_apiredmine();

        this._indicator.connect('newissueid', (ind, issueid) => this._add_issue(issueid));
        this._indicator.connect('refresh', () => this.refresh());

        // refresh everything every TIME_TO_REFRESH minutes
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, TIME_TOREFRESH * 60, () => this.refresh());

        this.refresh().then(_result => {});
    }

    destroy() {
        this._extension = null;
        this._indicator = null;
        this._settings = null;
    }

    _init_apiredmine() {
        this.apiredmine = new ApiRedmine(
            this._settings.get_string('redmine-url'),
            this._settings.get_string('redmine-token')
        );

        // Watch for changes to a specific setting
        this._settings.connect('changed::redmine-url', (settings, key) => {
            console.debug(`${key} = ${settings.get_string(key).print(true)}`);
            this.apiredmine.url = settings.get_string(key);
            this._connect();
        });
        this._settings.connect('changed::redmine-url', (settings, key) => {
            console.debug(`${key} = ${settings.get_string(key).print(true)}`);
            this.apiredmine.token = settings.get_string(key);
            this._connect();
        });
    }


    async _connect() {
        try {
            let account_res = await this.apiredmine.myaccount();
            log(`accout_res=${JSON.stringify(account_res)}`);
            this._indicator.set_url_all_records(`${this.apiredmine.url}/activity?user_id=${this.apiredmine.user_id}`);
        } catch (error) {
            Utils.notify_warn('Unable to connect to redmine');
        }
    }

    async refresh() {
        try {
            log('redmine refreshing...');
            await this._connect();
            await this._update_projects();
            await this._update_issues();
            await this._update_records();
        } catch (error) {
            Utils.error(error);
        }
    }

    async _add_issue(issueid) {
        try {
            let data = null;
            try {
                data = await this.apiredmine.issue(issueid);
            } catch (error) {
                Utils.notify_warn(`Cannot retrieve id ${issueid} in redmine`);
                return;
            }
            await this._update_issue(data.issue);
        } catch (error) {
            Utils.notify_error(error);
        }
    }

    _create_project(data) {
        let project = new Project(this._indicator, this.apiredmine, data);
        let item = this._indicator.add_project(project.dataitem);
        project.mainitem(item);

        project.connect('time-updated', () => this._update_records());

        this._mapprojects[project.dataitem.id] = project;
        return project;
    }

    _create_issue(data) {
        let issue = new Issue(this._indicator, this.apiredmine, data);
        let item = this._indicator.add_issue(issue.dataitem);
        issue.mainitem(item);

        issue.connect('time-updated', () => this._update_records());

        this._mapissues[issue.dataitem.id] = issue;
        return issue;
    }

    async _update_project(data) {
        let project = this._mapprojects[data.id];
        if (project === undefined)
            project = this._create_project(data);
        else
            project.refresh(data);
        return project;
    }

    async _update_issue(data) {
        let issue = this._mapissues[data.id];
        if (this._mapprojects[data.project.id] === undefined) {
            let pjdata = await this.apiredmine.project(data.project.id);
            await this._update_project(pjdata.project);
        }

        data.time_entry_activities = this._mapprojects[data.project.id].dataitem.time_entry_activities;

        if (issue === undefined)
            this._create_issue(data);
        else
            issue.refresh(data);
    }

    async _update_projects() {
        let tasks = [];
        let data = await this.apiredmine.projects();
        for (let project of data.projects)
            tasks.push(this._update_project(project));

        await Promise.all(tasks);
    }

    async _update_issues() {
        let tasks = [];
        let data = await this.apiredmine.issues(this._nb_issues);
        for (let issue of data.issues)
            tasks.push(this._update_issue(issue));

        await Promise.all(tasks);
    }

    async _record(time_entry) {
        let issueproject = null;

        if (time_entry.issue) { // set issue
            issueproject = this._mapissues[time_entry.issue.id];

            if (!issueproject)
                issueproject = await this._update_issue(await this.apiredmine.issue(time_entry.issue.id));
        } else if (time_entry.project) { // set project
            issueproject = this._mapprojects[time_entry.project.id];
            if (!issueproject)
                issueproject = await this._update_project(await this.apiredmine.project(time_entry.project.id));
        }

        issueproject.record(time_entry.id, time_entry.hours, time_entry.activity.name);
    }

    async _update_records() {
        let tasks = [];

        let sum = 0;

        for (let time_entry of (await this.apiredmine.time_entries()).time_entries) {
            sum += time_entry.hours;
            tasks.push(this._record(time_entry));
        }
        this._record_time = sum;
        this._indicator.set_time_all_records(this._record_time);

        await Promise.all(tasks);
    }
}
