/* eslint-disable require-await */
import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

// ROUTES
// highest_issue = this.makeRequest("GET", "/issues.json?assigned_to_id=me&limit=1");
const R_ACCOUNT = '/my/account';
const R_ISSUES = '/issues';
const R_CREATE_TIME_ENTRY = '/time_entries';
const R_PROJECTS = '/projects';
const R_TIME_ENTRY_ACTIVITIES = '/enumerations/time_entry_activities';
const R_TIME_ENTRIES = '/time_entries';

const STATUS_OK = [Soup.Status.OK, Soup.Status.NO_CONTENT, Soup.Status.CREATED];

export class ApiRedmine {
    constructor(url, token) {
        this.url = url;
        this.token = token;
        this._session = new Soup.Session();
        this.size_issue = 10;
        this.user_id = null;
    }

    current_date() {
        const paddingzero = val => String(val).padStart(2, '0');
        let date = new Date();
        return `${date.getFullYear()}-${paddingzero(date.getMonth() + 1)}-${paddingzero(date.getDate())}`;
    }

    makeRequest(type, route, opts, data) {
        return new Promise((resolve, reject) => {
            let uri = `${this.url}${route}.json`;
            if (opts)
                uri = `${uri}?${opts}`;


            console.debug(`MESSAGE  uri=${uri}`);
            const message = Soup.Message.new(type, uri);
            message.request_headers.append('Content-Type', 'application/json');
            message.request_headers.append('X-Redmine-API-Key', this.token);

            try {
                if (data) {
                    console.debug(`request data=${JSON.stringify(data)}`);
                    let bufencode = new TextEncoder().encode(JSON.stringify(data));
                    let bufencodeglibbytes = GLib.Bytes.new(bufencode);
                    message.set_request_body_from_bytes('application/json', bufencodeglibbytes);
                }
            } catch (e) {
                throw new Error('data encode');
            }

            this._session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                try {
                    let bytes = session.send_and_read_finish(result);
                    let decoder = new TextDecoder('utf-8');
                    let response = decoder.decode(bytes.get_data());

                    if (!STATUS_OK.includes(message.get_status()))
                        throw new Error(`error request status=${message.get_status()} ${response}`);


                    console.debug(`Response: ${response}`);
                    if (response)
                        resolve(JSON.parse(response));
                    else
                        resolve();
                } catch (e) {
                    console.error(`error request=${e}`);
                    reject(e);
                    throw e;
                }
            });
        });
    }

    // redmine api
    async myaccount() {
        let res = await this.makeRequest('GET', R_ACCOUNT, null);
        // get highest issue
        let data_highest_issue = await this.issues(1);
        if (data_highest_issue && data_highest_issue.issues && data_highest_issue.issues[0]) {
            this.size_issue = `${data_highest_issue.issues[0].id}`.length;
            console.debug(`SIZE ISSUE=${this.size_issue}`);
        }
        this.user_id = res.user.id;
        return res;
    }

    async issues(limit, issue_ids, status, assigned) {
        let opts = 'updated_on:desc&assigned_to_id='; // sort with update first
        opts += assigned ? `${assigned}` : 'me';

        if (limit)
            opts += `&limit=${limit}`;
        if (issue_ids)
            opts += `&issue_id=${issue_ids.join(',')}`;
        if (status)
            opts += `&status_id=${status}`;

        return this.makeRequest('GET', R_ISSUES, opts);
    }

    async issue(issue_id) {
        return this.makeRequest('GET', `${R_ISSUES}/${issue_id}`);
    }

    async create_time_entry(issue_id, project_id, hours, activity_id, spent_on, comments) {
        if (!spent_on)
            spent_on = this.current_date();

        return this.makeRequest('POST', R_CREATE_TIME_ENTRY, null, {
            'time_entry': {
                issue_id,
                project_id,
                spent_on,
                activity_id,
                hours,
                'user_id': this.user_id,
                comments,
            },
        });
    }

    async update_time_entry(time_id, hours, activity_id, comments) {
        let data = {};
        if (hours)
            data.hours = hours;
        if (activity_id)
            data.activity_id = activity_id;
        if (comments)
            data.comments = comments;
        return this.makeRequest('PUT', `${R_CREATE_TIME_ENTRY}/${time_id}`, null, {
            'time_entry': data,
        });
    }

    async delete_time_entry(time_id) {
        return this.makeRequest('DELETE', `${R_CREATE_TIME_ENTRY}/${time_id}`, null, null);
    }

    async projects() {
        return this.makeRequest('GET', R_PROJECTS, 'include=time_entry_activities');
    }

    async project(pj_id) {
        return this.makeRequest('GET', `${R_PROJECTS}/${pj_id}`, 'include=time_entry_activities');
    }

    async time_entry_activities() {
        return this.makeRequest('GET', R_TIME_ENTRY_ACTIVITIES);
    }

    async time_entry(time_id) {
        return this.makeRequest('GET', `${R_TIME_ENTRIES}/${time_id}`);
    }

    async time_entries() {
        return this.makeRequest('GET', R_TIME_ENTRIES, `user_id=${this.user_id}&spent_on=${this.current_date()}`);
    }
}
