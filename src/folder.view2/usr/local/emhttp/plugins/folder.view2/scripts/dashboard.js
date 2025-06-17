/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    // ########################################
    // ##########       DOCKER       ##########
    // ########################################

    // if docker is enabled
    if($('tbody#docker_view').length > 0) {

        let prom = await Promise.all(folderReq.docker);
        // Parse the results
        let folders = JSON.parse(prom[0]);
        const unraidOrder = JSON.parse(prom[1]);
        const containersInfo = JSON.parse(prom[2]);
        let order = Object.values(JSON.parse(prom[3]));
    
        // Filter the order to get the container that aren't in the order, this happen when a new container is created
        let newOnes = order.filter(x => !unraidOrder.includes(x));

        // Insert the folder in the unraid folder into the order shifted by the unlisted containers
        for (let index = 0; index < unraidOrder.length; index++) {
            const element = unraidOrder[index];
            if((folderRegex.test(element) && folders[element.slice(7)])) {
                order.splice(index+newOnes.length, 0, element);
            }
        }

        // debug mode, download the debug json file
        if(folderDebugMode) {
            let element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify({
                version: (await $.get('/plugins/folder.view2/server/version.php').promise()).trim(),
                folders,
                unraidOrder,
                originalOrder: JSON.parse(await $.get('/plugins/folder.view2/server/read_unraid_order.php?type=docker').promise()),
                newOnes,
                order,
                containersInfo
            })));
            element.setAttribute('download', 'debug-DASHBOARD-DOCKER.json');
        
            element.style.display = 'none';
            document.body.appendChild(element);
        
            element.click();
        
            document.body.removeChild(element);
            console.log('Docker Order:', [...order]);
        }
    
        let foldersDone = {};

        folderEvents.dispatchEvent(new CustomEvent('docker-pre-folders-creation', {detail: {
            folders: folders,
            order: order,
            containersInfo: containersInfo
        }}));

        // Draw the folders in the order
        for (let key = 0; key < order.length; key++) {
            const container = order[key];
            if (container && folderRegex.test(container)) {
                let id = container.replace(folderRegex, '');
                if (folders[id]) {
                    key -= createFolderDocker(folders[id], id, key, order, containersInfo, Object.keys(foldersDone));
                    key -= newOnes.length;
                    // Move the folder to the done object and delete it from the undone one
                    foldersDone[id] = folders[id];
                    delete folders[id];
                }
            }
        }
    
        // Draw the foldes outside of the order
        for (const [id, value] of Object.entries(folders)) {
            // Add the folder on top of the array
            order.unshift(`folder-${id}`);
            createFolderDocker(value, id, 0, order, containersInfo, Object.keys(foldersDone));
            // Move the folder to the done object and delete it from the undone one
            foldersDone[id] = folders[id];
            delete folders[id];
        }
    
        // if started only is active hide all stopped folder
        if ($('input#apps').is(':checked')) {
            $('tbody#docker_view > tr.updated > td > div > span.outer.stopped').css('display', 'none');
        }

        
    
        // Expand folders that are set to be expanded by default, this is here because is easier to work with all compressed folder when creating them
        for (const [id, value] of Object.entries(foldersDone)) {
            if ((globalFolders.docker && globalFolders.docker[id].status.expanded) || value.settings.expand_dashboard) {
                value.status.expanded = true;
                expandFolderDocker(id);
            }
        }

        folderEvents.dispatchEvent(new CustomEvent('docker-post-folders-creation', {detail: {
            folders: folders,
            order: order,
            containersInfo: containersInfo
        }}));
    
        // Assing the folder done to the global object
        globalFolders.docker = foldersDone;

    }


    // ########################################
    // ##########         VMS        ##########
    // ########################################

    // if vm is enabled
    if($('tbody#vm_view').length > 0) {

        const prom = await Promise.all(folderReq.vm);
        // Parse the results
        let folders = JSON.parse(prom[0]);
        const unraidOrder = Object.values(JSON.parse(prom[1]));
        const vmInfo = JSON.parse(prom[2]);
        let order = Object.values(JSON.parse(prom[3]));
    
        // Filter the webui order to get the container that aren't in the order, this happen when a new container is created
        let newOnes = order.filter(x => !unraidOrder.includes(x));

        // Insert the folder in the unraid folder into the order shifted by the unlisted containers
        for (let index = 0; index < unraidOrder.length; index++) {
            const element = unraidOrder[index];
            if((folderRegex.test(element) && folders[element.slice(7)])) {
                order.splice(index+newOnes.length, 0, element);
            }
        }

        // debug mode, download the debug json file
        if(folderDebugMode) {
            let element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify({
                version: (await $.get('/plugins/folder.view2/server/version.php').promise()).trim(),
                folders,
                unraidOrder,
                originalOrder: JSON.parse(await $.get('/plugins/folder.view2/server/read_unraid_order.php?type=vm').promise()),
                newOnes,
                order,
                vmInfo
            })));
            element.setAttribute('download', 'debug-DASHBOARD-VM.json');
        
            element.style.display = 'none';
            document.body.appendChild(element);
        
            element.click();
        
            document.body.removeChild(element);
            console.log('VM Order:', [...order]);
        }
    
        let foldersDone = {};

        folderEvents.dispatchEvent(new CustomEvent('vm-pre-folders-creation', {detail: {
            folders: folders,
            order: order,
            vmInfo: vmInfo
        }}));

        // Draw the folders in the order
        for (let key = 0; key < order.length; key++) {
            const container = order[key];
            if (container && folderRegex.test(container)) {
                let id = container.replace(folderRegex, '');
                if (folders[id]) {
                    key -= createFolderVM(folders[id], id, key, order, vmInfo, Object.keys(foldersDone));
                    key -= newOnes.length;
                    // Move the folder to the done object and delete it from the undone one
                    foldersDone[id] = folders[id];
                    delete folders[id];
                }
            }
        }
    
        // Draw the foldes outside of the order
        for (const [id, value] of Object.entries(folders)) {
            // Add the folder on top of the array
            order.unshift(`folder-${id}`);
            createFolderVM(value, id, 0, order, vmInfo, Object.keys(foldersDone));
            // Move the folder to the done object and delete it from the undone one
            foldersDone[id] = folders[id];
            delete folders[id];
        }

        // if started only is active hide all stopped folder
        if ($('input#vms').is(':checked')) {
            $('tbody#vm_view > tr.updated > td > div > span.outer.stopped').css('display', 'none');
        }

        // Expand folders that are set to be expanded by default, this is here because is easier to work with all compressed folder when creating them
        for (const [id, value] of Object.entries(foldersDone)) {
            if ((globalFolders.vms && globalFolders.vms[id].status.expanded) || value.settings.expand_dashboard) {
                value.status.expanded = true;
                expandFolderVM(id);
            }
        }

        folderEvents.dispatchEvent(new CustomEvent('vm-post-folders-creation', {detail: {
            folders: folders,
            order: order,
            vmInfo: vmInfo
        }}));

        globalFolders.vms = foldersDone;
    }

    folderDebugMode  = false;
};

/**
 * Handles the creation of one folder
 * @param {object} folder the folder
 * @param {string} id if of the folder
 * @param {int} position position to inset the folder
 * @param {Array<string>} order order of containers
 * @param {object} containersInfo info of the containers
 * @param {Array<string>} foldersDone folders that are done
 * @returns the number of element removed before the folder
 */
const createFolderDocker = (folder, id, position, order, containersInfo, foldersDone) => {

    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    // default varibles
    let upToDate = true;
    let started = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let managed = 0;
    let remBefore = 0;

    // If regex is present searches all containers for a match and put them inside the folder containers
    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    folder.containers = folder.containers.concat(order.filter(el => containersInfo[el]?.Labels['folder.view2'] === folder.name));

    // the HTML template for the folder
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer"><span class="outer solid apps stopped folder-docker"><span id="folder-id-${id}" onclick='addDockerFolderContext("${id}")' class="hand docker folder-hand-docker"><img src="${folder.icon}" class="img folder-img-docker" onerror="this.src='/plugins/dynamix.docker.manager/images/question.png';"></span><span class="inner folder-inner-docker"><span class="folder-appname-docker">${folder.name}</span><br><i class="fa fa-square stopped red-text folder-load-status-docker"></i><span class="state folder-state-docker">${$.i18n('stopped')}</span></span><div class="folder-storage"></div></span><div class="folder-showcase-${id} folder-showcase"></div></div>`;

    // insertion at position of the folder
    if (position === 0) {
        $('tbody#docker_view > tr.updated > td').children().eq(position).before($(fld));
    } else {
        $('tbody#docker_view > tr.updated > td').children().eq(position - 1).after($(fld));
    }

    // new folder is needed for not altering the old containers
    let newFolder = {};

    // foldersDone is and array of only ids there is the need to add the 'folder-' in front
    foldersDone = foldersDone.map(e => 'folder-'+e);

    // remove the undone folders from the order, needed because they can cause an offset when grabbing the containers
    const cutomOrder = order.filter((e) => {
        return e && (foldersDone.includes(e) || !(folderRegex.test(e) && e !== `folder-${id}`));
    });

    // loop over the containers
    for (const container of folder.containers) {
        // get both index, tis is needed for removing from the orders later
        const index = cutomOrder.indexOf(container);
        const offsetIndex = order.indexOf(container);

        folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-preview', {detail: {
            folder: folder,
            id: id,
            position: position,
            order: order,
            containersInfo: containersInfo,
            foldersDone: foldersDone,
            container: container,
            ct: containersInfo[container],
            index: index,
            offsetIndex: offsetIndex
        }}));

        if (index > -1) {

            // Keep track of removed elements before the folder to set back the for loop for creating folders, otherwise folder will be skipped
            if(offsetIndex < position) {
                remBefore += 1;
            }

            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);
            const ct = containersInfo[container];

            // grab the storage folder
            const element = $(`tbody#docker_view span#folder-id-${id}`).siblings('div.folder-storage');
            // grab the container and put it onto the storage
            element.append($('tbody#docker_view > tr.updated > td').children().eq(index).addClass(`folder-${id}-element`).addClass(`folder-element-docker`).addClass(`${!(ct.info.State.Autostart === false) ? 'autostart' : ''}`));
            

            newFolder[container] = {};
            newFolder[container].id = ct.shortId;
            newFolder[container].pause = ct.info.State.Paused;
            newFolder[container].state = ct.info.State.Running;
            newFolder[container].update = ct.info.State.Updated === false && ct.info.State.manager === 'dockerman';
            newFolder[container].managed = ct.info.State.manager === 'dockerman';

            if(folderDebugMode) {
                console.log(`Docker ${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }

            // set the status of the folder
            upToDate = upToDate && !newFolder[container].update;
            started += newFolder[container].state ? 1 : 0;
            autostart += !(ct.info.State.Autostart === false) ? 1 : 0;
            autostartStarted += ((!(ct.info.State.Autostart === false)) && newFolder[container].state) ? 1 : 0;
            managed += newFolder[container].managed ? 1 : 0;

            folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: position,
                order: order,
                containersInfo: containersInfo,
                foldersDone: foldersDone,
                container: container,
                ct: containersInfo[container],
                index: index,
                offsetIndex: offsetIndex,
                states: {
                    upToDate,
                    started,
                    autostart,
                    autostartStarted,
                    managed
                }
            }}));
        }
    }

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;

    //temp var
    const sel = $(`tbody#docker_view span#folder-id-${id}`)
    
    //set tehe status of a folder

    if (!upToDate) {
        sel.next('span.inner').children().first().addClass('blue-text');
    }

    if (started) {
        sel.parent().removeClass('stopped').addClass('started');
        sel.next('span.inner').children('i').replaceWith($('<i class="fa fa-play started green-text"></i>'));
        sel.next('span.inner').children('span.state').text(`${started}/${Object.entries(folder.containers).length} ${$.i18n('started')}`);
    }

    if(autostart === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-full');
    }

    if(managed === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-managed');
    } else if (managed > 0 && managed < Object.values(folder.containers).length) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('managed-partial');
    } else if (managed > 0 && managed === Object.values(folder.containers).length) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('managed-full');
    }

    // set the status
    folder.status = {};
    folder.status.upToDate = upToDate;
    folder.status.started = started;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.managed = managed;
    folder.status.expanded = false;

    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        containersInfo: containersInfo,
        foldersDone: foldersDone
    }}));

    return remBefore;
};

/**
 * Handles the creation of one folder
 * @param {object} folder the folder
 * @param {string} id if of the folder
 * @param {int} position position to inset the folder
 * @param {Array<string>} order order of vms
 * @param {object} vmInfo info of the vms
 * @param {Array<string>} foldersDone folders that are done
 * @returns the number of element removed before the folder
 */
const createFolderVM = (folder, id, position, order, vmInfo, foldersDone) => {

    folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        vmInfo: vmInfo,
        foldersDone: foldersDone
    }}));

    // default varibles
    let started = 0;
    let autostart = 0;
    let autostartStarted = 0;
    let remBefore = 0;

    // If regex is present searches all containers for a match and put them inside the folder containers
    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    // the HTML template for the folder
    const fld = `<div class="folder-showcase-outer-${id} folder-showcase-outer"><span class="outer solid vms stopped folder-vm"><span id="folder-id-${id}" onclick='addVMFolderContext("${id}")' class="hand vm folder-hand-vm"><img src="${folder.icon}" class="img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner-vm">${folder.name}<br><i class="fa fa-square stopped red-text folder-load-status-vm"></i><span class="state folder-state-vm">${$.i18n('stopped')}</span></span><div class="folder-storage" style="display:none"></div></span><div class="folder-showcase-${id} folder-showcase"></div></div>`;

    // insertion at position of the folder
    if (position === 0) {
        $('tbody#vm_view > tr.updated > td').children().eq(position).before($(fld));
    } else {
        $('tbody#vm_view > tr.updated > td').children().eq(position - 1).after($(fld));
    }

    // new folder is needed for not altering the old containers
    let newFolder = {};

    // foldersDone is and array of only ids there is the need to add the 'folder-' in front
    foldersDone = foldersDone.map(e => 'folder-'+e);

    // remove the undone folders from the order, needed because they can cause an offset when grabbing the containers
    const cutomOrder = order.filter((e) => {
        return e && (foldersDone.includes(e) || !(folderRegex.test(e) && e !== `folder-${id}`));
    });

    // loop over the containers
    for (const container of folder.containers) {
        // get both index, tis is needed for removing from the orders later
        const index = cutomOrder.indexOf(container);
        const offsetIndex = order.indexOf(container);

        folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-preview', {detail: {
            folder: folder,
            id: id,
            position: position,
            order: order,
            vmInfo: vmInfo,
            foldersDone: foldersDone,
            vm: container,
            ct: vmInfo[container],
            index: index,
            offsetIndex: offsetIndex
        }}));

        if (index > -1) {

            // Keep track of removed elements before the folder to set back the for loop for creating folders, otherwise folder will be skipped
            if(offsetIndex < position) {
                remBefore += 1;
            }

            // remove the containers from the order
            cutomOrder.splice(index, 1);
            order.splice(offsetIndex, 1);

            // add the id to the container name 
            const ct = vmInfo[container];
            newFolder[container] = {};
            newFolder[container].id = ct.uuid;
            newFolder[container].state = ct.state;

            // grab the container and put it onto the storage
            $(`tbody#vm_view span#folder-id-${id}`).siblings('div.folder-storage').append($('tbody#vm_view > tr.updated > td').children().eq(index).addClass(`folder-${id}-element`).addClass(`folder-element-vm`).addClass(`${ct.autostart ? 'autostart' : ''}`));

            if(folderDebugMode) {
                console.log(`VM ${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }
            
            // set the status of the folder
            started += ct.state!=="shutoff" ? 1 : 0;
            autostart += ct.autostart ? 1 : 0;
            autostartStarted += (ct.autostart && ct.state!=="shutoff") ? 1 : 0;

            folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-preview', {detail: {
                folder: folder,
                id: id,
                position: position,
                order: order,
                vmInfo: vmInfo,
                foldersDone: foldersDone,
                vm: container,
                ct: vmInfo[container],
                index: index,
                offsetIndex: offsetIndex,
                states: {
                    started,
                    autostart,
                    autostartStarted
                }
            }}));
        }
    }

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;

    
    //set tehe status of a folder
    if (started) {
        const sel = $(`tbody#vm_view span#folder-id-${id}`);
        sel.parent().removeClass('stopped').addClass('started');
        sel.next('span.inner').children('i').replaceWith($('<i class="fa fa-play started green-text"></i>'));
        sel.next('span.inner').children('span.state').text(`${started}/${Object.entries(folder.containers).length} ${$.i18n('started')}`);
    }

    if(autostart === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`.folder-showcase-outer-${id}, .folder-showcase-outer-${id} > span.outer`).addClass('autostart-full');
    }

    // set the status
    folder.status = {};
    folder.status.started = started;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.expanded = false;

    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-creation', {detail: {
        folder: folder,
        id: id,
        position: position,
        order: order,
        vmInfo: vmInfo,
        foldersDone: foldersDone
    }}));

    return remBefore;
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const expandFolderDocker = (id) => {
    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-expansion', {detail: { id }}));
    const el = $(`tbody#docker_view > tr.updated > td span.outer.apps > span#folder-id-${id}`);
    const state = el.attr('expanded') === "true";
    if (state) {
        el.siblings('div.folder-storage').append(el.parents().siblings('div.folder-showcase').children());
        el.attr('expanded', 'false');
    } else {
        el.parents().siblings('div.folder-showcase').append(el.siblings('div.folder-storage').children());
        el.attr('expanded', 'true');
    }
    $(`tbody#docker_view .folder-showcase-outer-${id}`).attr('expanded', !state ? 'true' : 'false');
    if(globalFolders.docker) {
        globalFolders.docker[id].status.expanded = !state;
    }
    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-expansion', {detail: { id }}));
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const expandFolderVM = (id) => {
    folderEvents.dispatchEvent(new CustomEvent('vm-pre-folder-expansion', {detail: { id }}));
    const el = $(`tbody#vm_view > tr.updated > td span.outer.vms > span#folder-id-${id}`);
    const state = el.attr('expanded') === "true";
    if (state) {
        el.siblings('div.folder-storage').append(el.parents().siblings('div.folder-showcase').children());
        el.attr('expanded', 'false');
    } else {
        el.parents().siblings('div.folder-showcase').append(el.siblings('div.folder-storage').children());
        el.attr('expanded', 'true');
    }
    $(`tbody#vm_view .folder-showcase-outer-${id}`).attr('expanded', !state ? 'true' : 'false');
    if(globalFolders.vms) {
        globalFolders.vms[id].status.expanded = !state;
    }
    folderEvents.dispatchEvent(new CustomEvent('vm-post-folder-expansion', {detail: { id }}));
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmDockerFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders.docker[id].name}`,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: $.i18n('yes-delete'),
        cancelButtonText: $.i18n('cancel'),
        showLoaderOnConfirm: true
    },
    async (c) => {
        if (!c) { setTimeout(loadlist); return; }
        $('div.spinner.fixed').show('slow');
        await $.get('/plugins/folder.view2/server/delete.php?type=docker&id=' + id).promise();
        loadedFolder = false;
        setTimeout(loadlist(), 500)
    });
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmVMFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders.vms[id].name}`,
        type: 'warning',
        html: true,
        showCancelButton: true,
        confirmButtonText: $.i18n('yes-delete'),
        cancelButtonText: $.i18n('cancel'),
        showLoaderOnConfirm: true
    },
    async (c) => {
        if (!c) { setTimeout(loadlist); return; }
        $('div.spinner.fixed').show('slow');
        await $.get('/plugins/folder.view2/server/delete.php?type=vm&id=' + id).promise();
        loadedFolder = false;
        setTimeout(loadlist(), 500)
    });
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editDockerFolder = (id) => {
    location.href = location.pathname + "/Folder?type=docker&id=" + id;
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editVMFolder = (id) => {
    location.href = location.pathname + "/Folder?type=vm&id=" + id;
};

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderDockerCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const folder = globalFolders.docker[id];
    let act = folder.actions[action];
    let prom = [];
    if(act.type === 0) {
        const cts = act.conatiners.map(e => folder.containers[e]).filter(e => e);
        let ctAction = (e) => {};
        if(act.action === 0) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(e.state) {
                        prom.push($.post(eventURL, {action: 'stop', container:e.id}, null,'json').promise());
                    } else {
                        prom.push($.post(eventURL, {action: 'start', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state) {
                        if(e.pause) {
                            prom.push($.post(eventURL, {action: 'resume', container:e.id}, null,'json').promise());
                        } else {
                            prom.push($.post(eventURL, {action: 'pause', container:e.id}, null,'json').promise());
                        }
                    }
                };
            }

        } else if(act.action === 1) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(!e.state) {
                        prom.push($.post(eventURL, {action: 'start', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state) {
                        prom.push($.post(eventURL, {action: 'stop', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 2) {
                ctAction = (e) => {
                    if(e.state && !e.pause) {
                        prom.push($.post(eventURL, {action: 'pause', container:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 3) {
                ctAction = (e) => {
                    if(e.state && e.pause) {
                        prom.push($.post(eventURL, {action: 'resume', container:e.id}, null,'json').promise());
                    }
                };
            }

        } else if(act.action === 2) {

            ctAction = (e) => {
                prom.push($.post(eventURL, {action: 'restart', container:e.id}, null,'json').promise());
            };

        }

        cts.forEach((e) => {
            ctAction(e);
        });
    } else if(act.type === 1) {
        const args = act.script_args || '';
        if(act.script_sync) {
            let scriptVariables = {}
            let rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1] });
            if(scriptVariables['directPHP']) {
                $.post("/plugins/user.scripts/exec.php",{action:'directRunScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) { openBox(data,act.name,800,1200, 'loadlist');}})
            } else {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}});
            }
        } else {
            const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
        }
    }

    await Promise.all(prom);

    loadlist();
    $('div.spinner.fixed').hide('slow');
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addDockerFolderContext = (id) => {
    // get the expanded status, needed to swap expand/ compress
    const exp = $(`tbody#docker_view .folder-showcase-outer-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? $.i18n('compress') : $.i18n('expand'),
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderDocker(id); }
    });

    opts.push({
        divider: true
    });

    if(globalFolders.docker[id].settings.override_default_actions && globalFolders.docker[id].actions && globalFolders.docker[id].actions.length) {
        opts.push(
            ...globalFolders.docker[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        );
    
        opts.push({
            divider: true
        });

    } else if(!globalFolders.docker[id].settings.default_action) {
        opts.push({
            text: $.i18n('start'),
            icon: 'fa-play',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "start"); }
        });
        opts.push({
            text: $.i18n('stop'),
            icon: 'fa-stop',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "stop"); }
        });
        
        opts.push({
            text: $.i18n('pause'),
            icon: 'fa-pause',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "pause"); }
        });
    
        opts.push({
            text: $.i18n('resume'),
            icon: 'fa-play-circle',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "resume"); }
        });
    
        opts.push({
            text: $.i18n('restart'),
            icon: 'fa-refresh',
            action: (e) => { e.preventDefault(); actionFolderDocker(id, "restart"); }
        });
    
        opts.push({
            divider: true
        });
    }

    if(globalFolders.docker[id].status.managed > 0) {
        if(!globalFolders.docker[id].status.upToDate) {
            opts.push({
                text: $.i18n('update'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault();  updateFolderDocker(id); }
            });
        } else {
            opts.push({
                text: $.i18n('update-force'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault(); forceUpdateFolderDocker(id); }
            });
        }
        
        opts.push({
            divider: true
        });
    }

    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editDockerFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmDockerFolder(id); }
    });

    if(!globalFolders.docker[id].settings.override_default_actions && globalFolders.docker[id].actions && globalFolders.docker[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders.docker[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderDockerCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('docker-folder-context', {detail: { id, opts }}));

    context.attach(`#folder-id-${id}`, opts);
};

/**
 * Force update all the containers inside a folder
 * @param {string} id the id of the folder
 */
const forceUpdateFolderDocker = (id) => {
    const folder = globalFolders.docker[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Update all the updatable containers inside a folder
 * @param {string} id the id of the folder
 */
const updateFolderDocker = (id) => {
    const folder = globalFolders.docker[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed && v.update).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolderDocker = async (id, action) => {
    const folder =  globalFolders.docker[id];
    const cts = Object.keys(folder.containers);
    let proms = [];
    let errors;

    $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
    $('div.spinner.fixed').show('slow');

    for (let index = 0; index < cts.length; index++) {
        const ct = folder.containers[cts[index]];
        const cid = ct.id;
        let pass;
        switch (action) {
            case "start":
                pass = !ct.state;
                break;
            case "stop":
                pass = ct.state;
                break;
            case "pause":
                pass = ct.state && !ct.pause;
                break;
            case "resume":
                pass = ct.state && ct.pause;
                break;
            case "resume":
                pass = true;
                break;
            default:
                pass = false;
                break;
        }
        if(pass) {
            proms.push($.post(eventURL, {action: action, container:cid}, null,'json').promise());
        }
    }

    proms = await Promise.all(proms);
    errors = proms.filter(e => e.success !== true);
    errors = errors.map(e => e.success);

    if(errors.length > 0) {
        swal({
            title: $.i18n('exec-error'),
            text:errors.join('<br>'),
            type:'error',
            html:true,
            confirmButtonText:'Ok'
        }, loadlist);
    }

    loadlist();
    $('div.spinner.fixed').hide('slow');
}

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderVMCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const eventURL = '/plugins/dynamix.vm.manager/include/VMajax.php';
    const folder = globalFolders.vms[id];
    let act = folder.actions[action];
    let prom = [];
    if(act.type === 0) {
        const cts = act.conatiners.map(e => folder.containers[e]).filter(e => e);
        let ctAction = (e) => {};
        if(act.action === 0) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'stop', uuid:e.id}, null,'json').promise());
                    } else if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown"){
                        prom.push($.post(eventURL, {action: 'domain-start', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                    } else if(e.state === "paused" || e.state === "unknown") {
                        prom.push($.post(eventURL, {action: 'domain-resume', uuid:e.id}, null,'json').promise());
                    }
                };
            }

        } else if(act.action === 1) {

            if(act.modes === 0) {
                ctAction = (e) => {
                    if(e.state !== "running" && e.state !== "pmsuspended" && e.state !== "paused" && e.state !== "unknown") {
                        prom.push($.post(eventURL, {action: 'domain-start', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 1) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'domain-stop', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 2) {
                ctAction = (e) => {
                    if(e.state === "running") {
                        prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                    }
                };
            } else if(act.modes === 3) {
                ctAction = (e) => {
                    if(e.state === "paused" || e.state === "unknown") {
                        prom.push($.post(eventURL, {action: 'domain-restart', uuid:e.id}, null,'json').promise());
                    }
                };
            }

        } else if(act.action === 2) {

            ctAction = (e) => {
                if(e.state === "running") {
                    prom.push($.post(eventURL, {action: 'domain-pause', uuid:e.id}, null,'json').promise());
                }
            };

        }

        cts.forEach((e) => {
            ctAction(e);
        });
    } else if(act.type === 1) {
        const args = act.script_args || '';
        if(act.script_sync) {
            let scriptVariables = {}
            let rawVars = await $.post("/plugins/user.scripts/exec.php",{action:'getScriptVariables',script:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            rawVars.trim().split('\n').forEach((e) => { const variable = e.split('='); scriptVariables[variable[0]] = variable[1] });
            if(scriptVariables['directPHP']) {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2='+args,act.name,800,1200,true, 'loadlist');}});
            } else {
                $.post("/plugins/user.scripts/exec.php",{action:'convertScript',path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`},function(data) {if(data) {openBox('/plugins/user.scripts/startScript.sh&arg1='+data+'&arg2=',act.name,800,1200,true, 'loadlist');}});
            }
        } else {
            const cmd = await $.post("/plugins/user.scripts/exec.php",{action:'convertScript', path:`/boot/config/plugins/user.scripts/scripts/${act.script}/script`}).promise();
            prom.push($.get('/logging.htm?cmd=/plugins/user.scripts/backgroundScript.sh&arg1='+cmd+'&arg2='+args+'&csrf_token='+csrf_token+'&done=Done').promise());
        }
    }

    await Promise.all(prom);

    loadlist();
    $('div.spinner.fixed').hide('slow');
};

/**
 * Atach the menu when clicking the folder icon
 * @param {string} id the id of the folder
 */
const addVMFolderContext = (id) => {
    // get the expanded status, needed to swap expand/ compress
    const exp = $(`tbody#vm_view .folder-showcase-outer-${id}`).attr('expanded') === "true";
    let opts = [];
    context.settings({
        right: false,
        above: false
    });

    opts.push({
        text: exp ? $.i18n('compress') : $.i18n('expand'),
        icon: exp ? 'fa-minus' : 'fa-plus',
        action: (e) => { e.preventDefault(); expandFolderVM(id); }
    });
    
    opts.push({
        divider: true
    });

    if(globalFolders.vms[id].settings.override_default_actions && globalFolders.vms[id].actions && globalFolders.vms[id].actions.length) {
        opts.push(
            ...globalFolders.vms[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        );
    
        opts.push({
            divider: true
        });

    } else if(!globalFolders.vms[id].settings.default_action) {
        opts.push({
            text: $.i18n('start'),
            icon: "fa-play",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-start'); }
        });
    
        opts.push({
            text: $.i18n('stop'),
            icon: "fa-stop",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-stop'); }
        });
    
        opts.push({
            text: $.i18n('pause'),
            icon: "fa-pause",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-pause'); }
        });
    
        opts.push({
            text: $.i18n('resume'),
            icon: "fa-play-circle",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-resume'); }
        });
    
        opts.push({
            text: $.i18n('restart'),
            icon: "fa-refresh",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-restart'); }
        });
    
        opts.push({
            text: $.i18n('hibernate'),
            icon: "fa-bed",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-pmsuspend'); }
        });
    
        opts.push({
            text: $.i18n('force-stop'),
            icon: "fa-bomb",
            action: (e) => { e.preventDefault(); actionFolderVM(id, 'domain-destroy'); }
        });
    
        opts.push({
            divider: true
        });
    }


    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editVMFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmVMFolder(id); }
    });

    if(!globalFolders.vms[id].settings.override_default_actions && globalFolders.vms[id].actions && globalFolders.vms[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders.vms[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderVMCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('vm-folder-context', {detail: { id, opts }}));

    context.attach(`#folder-id-${id}`, opts);
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolderVM = async (id, action) => {
    const folder =  globalFolders.vms[id];
    const cts = Object.keys(folder.containers);
    let proms = [];
    let errors;
    const oldAction = action;

    $(`i#load-folder-${id}`).removeClass('fa-play fa-square fa-pause').addClass('fa-refresh fa-spin');
    $('div.spinner.fixed').show('slow');

    for (let index = 0; index < cts.length; index++) {
        const ct = folder.containers[cts[index]];
        const cid = ct.id;
        let pass;
        action = oldAction;
        switch (action) {
            case "domain-start":
                pass = ct.state !== "running" && ct.state !== "pmsuspended" && ct.state !== "paused" && ct.state !== "unknown";
                break;
            case "domain-stop":
            case "domain-pause":
            case "domain-restart":
            case "domain-pmsuspend":
                pass = ct.state === "running";
                break;
            case "domain-resume":
                pass = ct.state === "paused" || ct.state === "unknown";
                if(!pass) {
                    pass = ct.state === "pmsuspended";
                    action = "domain-pmwakeup";
                }
                break;
            case "domain-destroy":
                pass = ct.state === "running" || ct.state === "pmsuspended" || ct.state === "paused" || ct.state === "unknown";
                break;
            default:
                pass = false;
                break;
        }
        if(pass) {
            proms.push($.post('/plugins/dynamix.vm.manager/include/VMajax.php', {action: action, uuid: cid}, null,'json').promise());
        }
    }

    proms = await Promise.all(proms);
    errors = proms.filter(e => e.success !== true);
    errors = errors.map(e => e.success);

    if(errors.length > 0) {
        swal({
            title: $.i18n('exec-error'),
            text:errors.join('<br>'),
            type:'error',
            html:true,
            confirmButtonText:'Ok'
        }, loadlist);
    }

    loadlist();
    $('div.spinner.fixed').hide('slow');
}

// Global variables
let loadedFolder = false;
let globalFolders = {};
const folderRegex = /^folder-/;
let folderDebugMode = false;
let folderDebugModeWindow = [];
let folderReq = {
    docker: [],
    vm: []
};

// Patching the original function to make sure the containers are rendered before insering the folder
window.loadlist_original = loadlist;
window.loadlist = (x) => {
    loadedFolder = false;
    if($('tbody#docker_view').length > 0) { 
        folderReq.docker = [
            // Get the folders
            $.get('/plugins/folder.view2/server/read.php?type=docker').promise(),
            // Get the order as unraid sees it
            $.get('/plugins/folder.view2/server/read_order.php?type=docker').promise(),
            // Get the info on containers, needed for autostart, update and started
            $.get('/plugins/folder.view2/server/read_info.php?type=docker').promise(),
            // Get the order that is shown in the webui
            $.get('/plugins/folder.view2/server/read_unraid_order.php?type=docker').promise()
        ];
    }

    if($('tbody#vm_view').length > 0) {
        folderReq.vm = [
            // Get the folders
            $.get('/plugins/folder.view2/server/read.php?type=vm').promise(),
            // Get the order as unraid sees it
            $.get('/plugins/folder.view2/server/read_order.php?type=vm').promise(),
            // Get the info on VMs, needed for autostart and started
            $.get('/plugins/folder.view2/server/read_info.php?type=vm').promise(),
            // Get the order that is shown in the webui
            $.get('/plugins/folder.view2/server/read_unraid_order.php?type=vm').promise()
        ];
    }
    loadlist_original(x);
};

// this is needed to trigger the funtion to create the folders
$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/webGui/include/DashboardApps.php" && !loadedFolder) {
        jqXHR.promise().then(() => {
            createFolders();
            $('div.spinner.fixed').hide();
            loadedFolder = !loadedFolder
        });
    }
});

// activate debug mode
addEventListener("keydown", (e) => {
    if (e.isComposing || e.key.length !== 1) { // letter X FOR TESTING
        return;
    }
    folderDebugModeWindow.push(e.key);
    if(folderDebugModeWindow.length > 5) {
        folderDebugModeWindow.shift();
    }
    if(folderDebugModeWindow.join('').toLowerCase() === "debug") {
        folderDebugMode = true;
        loadlist();
    }
})