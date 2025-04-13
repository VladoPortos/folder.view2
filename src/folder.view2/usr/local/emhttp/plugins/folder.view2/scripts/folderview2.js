const populateTable = async () => {
    const proms = await Promise.all([
        $.get('/plugins/folder.view2/server/read.php?type=docker').promise(),
        $.get('/plugins/folder.view2/server/read.php?type=vm').promise()
    ]);
    dockers = JSON.parse(proms[0]);
    vms = JSON.parse(proms[1]);

    const dockerTable = $('tbody#docker');
    const vmsTable = $('tbody#vms');

    dockerTable.empty();
    vmsTable.empty();

    for (const [id, folder] of Object.entries(dockers)) {
        const fld = `<tr><td>${id}</td><td><img src="${folder.icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">${folder.name}</td><td><button onclick="downloadDocker('${id}')"><i class="fa fa-download"></i></button><button onclick="clearDocker('${id}')"><i class="fa fa-trash"></i></button></td></tr>`;
        dockerTable.append($(fld));
    }

    for (const [id, folder] of Object.entries(vms)) {
        const fld = `<tr><td>${id}</td><td><img src="${folder.icon}" class="img" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';">${folder.name}</td><td><button onclick="downloadVm('${id}')"><i class="fa fa-download"></i></button><button onclick="clearVm('${id}')"><i class="fa fa-trash"></i></button></td></tr>`;
        vmsTable.append($(fld));
    }
};

populateTable();

let dockers = {};
let vms = {};

const downloadDocker = (id) => {
    if (id) {
        downloadFile(`${dockers[id].name}.json`, JSON.stringify(dockers[id]));
    } else {
        downloadFile(`Docker.json`, JSON.stringify(dockers));
    }
};

const importDocker = () => {
    let input = $('input[type*=file]')[0];
    input.onchange = (e) => {

        // getting a hold of the file reference
        let file = e.target.files[0];

        // setting up the reader
        let reader = new FileReader();
        reader.readAsText(file, 'UTF-8');

        // here we tell the reader what to do when it's done reading...
        reader.onload = async (readerEvent) => {
            let content = readerEvent.target.result; // this is the content!
            $(input).off();
            try {
                content = JSON.parse(content);
            } catch (error) {
                swal({
                    title: 'Error',
                    text: 'Error parsing the input file, please select a JSON file',
                    type: 'error',
                });
            }
            if(content.name) {
                await $.post('/plugins/folder.view2/server/create.php', { type: 'docker', content: JSON.stringify(content) });
            } else {
                for (const [id, folder] of Object.entries(content)) {
                    await $.post('/plugins/folder.view2/server/update.php', { type: 'docker', content: JSON.stringify(folder), id: id });
                }
            }
            populateTable();
        }
    }
    input.click();
};

const importVm = () => {
    let input = $('input[type*=file]')[0];
    input.onchange = (e) => {

        // getting a hold of the file reference
        let file = e.target.files[0];

        // setting up the reader
        let reader = new FileReader();
        reader.readAsText(file, 'UTF-8');

        // here we tell the reader what to do when it's done reading...
        reader.onload = async (readerEvent) => {
            let content = readerEvent.target.result; // this is the content!
            $(input).off();
            try {
                content = JSON.parse(content);
            } catch (error) {
                swal({
                    title: 'Error',
                    text: 'Error parsing the input file, please select a JSON file',
                    type: 'error',
                });
            }
            if(content.name) {
                await $.post('/plugins/folder.view2/server/create.php', { type: 'vm', content: JSON.stringify(content) });
            } else {
                for (const [id, folder] of Object.entries(content)) {
                    await $.post('/plugins/folder.view2/server/update.php', { type: 'vm', content: JSON.stringify(folder), id: id });
                }
            }
            populateTable();
        }
    }
    input.click();
};

const clearDocker = (id) => {
    if (id) {
        swal({
            title: 'Are you sure?',
            text: `Remove folder: ${dockers[id].name}`,
            type: 'warning',
            html: true,
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true
        },
        async (c) => {
            if (!c) { return; }
            await $.get('/plugins/folder.view2/server/delete.php?type=docker&id=' + id).promise();
            populateTable();
        });
    } else {
        swal({
            title: 'Are you sure?',
            text: 'Remove ALL folders',
            type: 'warning',
            html: true,
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true
        },
        async (c) => {
            if (!c) { return; }
            for (const cid of Object.keys(dockers)) {
                await $.get('/plugins/folder.view2/server/delete.php?type=docker&id=' + cid).promise();
            }
            populateTable();
        });
    }
};

const downloadVm = (id) => {
    if (id) {
        downloadFile(`${vms[id].name}.json`, JSON.stringify(vms[id]));
    } else {
        downloadFile(`VM.json`, JSON.stringify(vms));
    }
};

const clearVm = (id) => {
    if (id) {
        swal({
            title: 'Are you sure?',
            text: `Remove folder: ${vms[id].name}`,
            type: 'warning',
            html: true,
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true
        },
        async (c) => {
            if (!c) { return; }
            await $.get('/plugins/folder.view2/server/delete.php?type=vm&id=' + id).promise();
            populateTable();
        });
    } else {
        swal({
            title: 'Are you sure?',
            text: 'Remove ALL folders',
            type: 'warning',
            html: true,
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel',
            showLoaderOnConfirm: true
        },
        async (c) => {
            if (!c) { return; }
            for (const cid of Object.keys(vms)) {
                await $.get('/plugins/folder.view2/server/delete.php?type=vm&id=' + cid).promise();
            }
            populateTable();
        });
    }
};

const downloadFile = (name, content) => {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', name);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();
};

const fileManager = async (type) => {
    location.href = location.pathname + '/Browse?dir=/boot/config/plugins/folder.view2';
};