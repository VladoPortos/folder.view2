/**
 * Handles the creation of all folders
 */
const createFolders = async () => {
    const prom = await Promise.all(folderReq);
    // Parse the results
    let folders = JSON.parse(prom[0]);
    const unraidOrder = JSON.parse(prom[1]);
    const containersInfo = JSON.parse(prom[2]);
    let order = Object.values(JSON.parse(prom[3]));

    // Filter the order to get the container that aren't in the order, this happen when a new container is created
    const newOnes = order.filter(x => !unraidOrder.includes(x));

    // Insert the folder in the unraid folder into the order shifted by the unlisted containers
    for (let index = 0; index < unraidOrder.length; index++) {
        const element = unraidOrder[index];
        if((folderRegex.test(element) && folders[element.slice(7)])) {
            order.splice(index+newOnes.length, 0, element);
        }
    }

    const autostartOrder = Object.values(containersInfo).filter(el => !(el.info.State.Autostart===false)).sort((a, b) => {
        if(a.info.State.Autostart < b.info.State.Autostart) {
          return -1;
        }
          if(a.info.State.Autostart > b.info.State.Autostart) {
          return 1;
        }
          return 0;
    }).map(el => el.info.Name);

    // debug mode, download the debug json file
    if(folderDebugMode) {
        let element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify({
            version: (await $.get('/plugins/folder.view/server/version.php').promise()).trim(),
            folders,
            unraidOrder,
            originalOrder: JSON.parse(await $.get('/plugins/folder.view/server/read_unraid_order.php?type=docker').promise()),
            newOnes,
            order,
            containersInfo
        })));
        element.setAttribute('download', 'debug-DOCKER.json');
    
        element.style.display = 'none';
        document.body.appendChild(element);
    
        element.click();
    
        document.body.removeChild(element);
        console.log('Order:', [...order]);
    }

    let foldersDone = {};

    if(folderobserver) {
        folderobserver.disconnect();
        folderobserver = undefined;
    }

    folderobserver = new MutationObserver((mutationList, observer) => {
        for (const mutation of mutationList) {
            if(/^load-/.test(mutation.target.id)) {
                $('i#folder-' + mutation.target.id).attr('class', mutation.target.className)
            }
        }
    });

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
                key -= createFolder(folders[id], id, key, order, containersInfo, Object.keys(foldersDone));
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
        createFolder(value, id, 0, order, containersInfo, Object.keys(foldersDone));
        // Move the folder to the done object and delete it from the undone one
        foldersDone[id] = folders[id];
        delete folders[id];
    }

    // Expand folders that are set to be expanded by default, this is here because is easier to work with all compressed folder when creating them
    for (const [id, value] of Object.entries(foldersDone)) {
        if ((globalFolders[id] && globalFolders[id].status.expanded) || value.settings.expand_tab) {
            value.status.expanded = true;
            dropDownButton(id);
        }
    }

    folderEvents.dispatchEvent(new CustomEvent('docker-post-folders-creation', {detail: {
        folders: folders,
        order: order,
        containersInfo: containersInfo
    }}));

    // Assing the folder done to the global object
    globalFolders = foldersDone;
    
    folderDebugMode = false;

    const autostartActual = $('.ct-name .appname').map(function() {return $(this).text()}).get().filter(x => autostartOrder.includes(x));

    if(!(autostartOrder.length === autostartActual.length && autostartOrder.every((value, index) => value === autostartActual[index]))) {
        $('.nav-item.AutostartOrder.util > a > b').removeClass('green-text').addClass('red-text');
        $('.nav-item.AutostartOrder.util > a > span').text($.i18n('incorrect-autostart'));
        $('.nav-item.AutostartOrder.util > a').attr('title', $.i18n('incorrect-autostart'));
    }
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
const createFolder = (folder, id, position, order, containersInfo, foldersDone) => {

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

    // Get if the advanced view is enabled
    const advanced = $.cookie('docker_listview_mode') == 'advanced';

    // If regex is present searches all containers for a match and put them inside the folder containers
    if (folder.regex) {
        const regex = new RegExp(folder.regex);
        folder.containers = folder.containers.concat(order.filter(el => regex.test(el)));
    }

    folder.containers = folder.containers.concat(order.filter(el => containersInfo[el]?.Labels['folder.view'] === folder.name));

    // the HTML template for the folder
    const colspan = document.querySelector("#docker_containers > thead > tr").childElementCount - 5;
    const fld = `<tr class="sortable folder-id-${id} ${folder.settings.preview_hover ? 'hover' : ''} folder"><td class="ct-name folder-name"><div class="folder-name-sub"><i class="fa fa-arrows-v mover orange-text"></i><span class="outer folder-outer"><span id="${id}" onclick="addDockerFolderContext('${id}')" class="hand folder-hand"><img src="${folder.icon}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></span><span class="inner folder-inner"><span class="appname" style="display: none;"><a>folder-${id}</a></span><a class="exec folder-appname" onclick='editFolder("${id}")'>${folder.name}</a><br><i id="load-folder-${id}" class="fa fa-square stopped red-text folder-load-status"></i><span class="state folder-state"> ${$.i18n('stopped')}</span></span></span><button class="dropDown-${id} folder-dropdown" onclick="dropDownButton('${id}')" ><i class="fa fa-chevron-down" aria-hidden="true"></i></button></div></td><td class="updatecolumn folder-update"><span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i> ${$.i18n('up-to-date')}</span><div class="advanced" style="display: ${advanced ? 'block' : 'none'};"><a class="exec" onclick="forceUpdateFolder('${id}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i> ${$.i18n('force-update')}</span></a></div></td><td colspan="${colspan}"><div class="folder-storage"></div><div class="folder-preview"></div></td><td class="advanced folder-advanced" ${advanced ? 'style="display: table-cell;"' : ''}><span class="cpu-folder-${id} folder-cpu">0%</span><div class="usage-disk mm folder-load"><span id="cpu-folder-${id}" class="folder-cpu-bar" style="width:0%"></span><span></span></div><br><span class="mem-folder-${id} folder-mem">0 / 0</span></td><td class="folder-autostart"><input type="checkbox" id="folder-${id}-auto" class="autostart" style="display:none"><div style="clear:left"></div></td><td></td></tr>`;

    // insertion at position of the folder
    if (position === 0) {
        $('#docker_list > tr.sortable').eq(position).before($(fld));
    } else {
        $('#docker_list > tr.sortable').eq(position - 1).after($(fld));
    }

    // create the *cool* unraid button for the autostart
    $(`#folder-${id}-auto`).switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on'), checked: false });

    // Set the border if enabled and set the color
    if(folder.settings.preview_border) {
        $(`tr.folder-id-${id}  div.folder-preview`).css('border', `solid ${folder.settings.preview_border_color} 1px`);
    }

    $(`tr.folder-id-${id} div.folder-preview`).addClass(`folder-preview-${folder.settings.preview}`);

    // select the preview function to use
    let addPreview;
    switch (folder.settings.preview) {
        case 1:
            addPreview = (id, ctid, autostart) => {
                let clone = $(`tr.folder-id-${id} div.folder-storage > tr > td.ct-name > span.outer:last`).clone();
                clone.find(`span.state`)[0].innerHTML = clone.find(`span.state`)[0].innerHTML.split("<br>")[0];
                $(`tr.folder-id-${id} div.folder-preview`).append(clone.addClass(`${autostart ? 'autostart' : ''}`));

                let tmpId = $(`tr.folder-id-${id} div.folder-preview > span.outer:last`).find('i[id^="load-"]');
                tmpId.attr("id", "folder-" + tmpId.attr("id"));
                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    tmpId = $(`tr.folder-id-${id} div.folder-preview > span.outer:last > span.hand`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if(folder.settings.context === 2) {
                        return tmpId;
                    }
                }
            };
            break;
        case 2:
            addPreview = (id, ctid, autostart) => {
                $(`tr.folder-id-${id} div.folder-preview`).append($(`tr.folder-id-${id} div.folder-storage > tr > td.ct-name > span.outer > span.hand:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));

                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    let tmpId = $(`tr.folder-id-${id} div.folder-preview > span.hand:last`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if(folder.settings.context === 2) {
                        return tmpId;
                    }
                }
            };
            break;
        case 3:
            addPreview = (id, ctid, autostart) => {
                let clone = $(`tr.folder-id-${id} div.folder-storage > tr > td.ct-name > span.outer > span.inner:last`).clone();
                clone.find(`span.state`)[0].innerHTML = clone.find(`span.state`)[0].innerHTML.split("<br>")[0];
                $(`tr.folder-id-${id} div.folder-preview`).append(clone.addClass(`${autostart ? 'autostart' : ''}`));
                
                let tmpId = $(`tr.folder-id-${id} div.folder-preview > span.inner:last`).find('i[id^="load-"]');
                tmpId.attr("id", "folder-" + tmpId.attr("id"));

                if(folder.settings.context === 2 || folder.settings.context === 0) {
                    tmpId = $(`tr.folder-id-${id} div.folder-preview > span.inner:last > span.appname > a.exec`);
                    tmpId.attr("id", "folder-preview-" + ctid);
                    tmpId.removeAttr("onclick");
                    if(folder.settings.context === 2) {
                        return tmpId;
                    }
                }
            };
            break;
        case 4:
                addPreview = (id, ctid, autostart) => {
                    let lstSpan = $(`tr.folder-id-${id} div.folder-preview > span.outer:last`);
                    if(!lstSpan[0] || lstSpan.children().length >= 2) {
                        $(`tr.folder-id-${id} div.folder-preview`).append($('<span class="outer"></span>'));
                        lstSpan = $(`tr.folder-id-${id} div.folder-preview > span.outer:last`);
                    }
                    lstSpan.append($('<span class="inner"></span>'));
                    lstSpan.children('span.inner:last').append($(`tr.folder-id-${id} div.folder-storage > tr > td.ct-name > span.outer > span.inner > span.appname:last`).clone().addClass(`${autostart ? 'autostart' : ''}`));

                    if(folder.settings.context === 2 || folder.settings.context === 0) {
                        let tmpId = $(`tr.folder-id-${id} div.folder-preview span.inner:last > span.appname > a.exec`);
                        tmpId.attr("id", "folder-preview-" + ctid);
                        tmpId.removeAttr("onclick");
                        if(folder.settings.context === 2) {
                            return tmpId.length>0 ? tmpId : $(`tr.folder-id-${id} div.folder-preview span.inner:last > span.appname`).attr("id", "folder-preview-" + ctid);
                        }
                    }
                };
                break;
        default:
            addPreview = (id) => { };
            break;
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

            // grab the container and put it onto the storage
            $(`tr.folder-id-${id} div.folder-storage`).append($('#docker_list > tr.sortable').eq(index).addClass(`folder-${id}-element`).addClass(`folder-element`).removeClass('sortable'));
            
            const ct = containersInfo[container];

            let CPU = [];
            let MEM = [];
            let charts = [];
            let tootltipObserver;

            const graphListener = (e) => {
                let now = Date.now();
                try {
                    let load = e.match(new RegExp(`^${ct.shortId}\;.*\;.*\ \/\ .*$`, 'm'))[0].split(';');
                    load = {
                        cpu: parseFloat(load[1].replace('%', ''))/cpus,
                        mem: load[2].split(' / ')
                    }
                    load.mem = memToB(load.mem[0]) / memToB(load.mem[1]) * 100;
                    CPU.push({
                        x: now,
                        y: load.cpu
                    });
                    MEM.push({
                        x: now,
                        y: load.mem
                    });
                } catch (error) {
                    CPU.push({
                        x: now,
                        y: 0
                    });
                    MEM.push({
                        x: now,
                        y: 0
                    });
                }
                
                for (const chart of charts) {
                    chart.update('quiet');
                }
            };

            const tooltip = addPreview(id, ct.shortId, !(ct.info.State.Autostart === false));
            $(`tr.folder-id-${id} div.folder-preview span.inner > span.appname`).css("width", folder.settings.preview_text_width || '');
            if(tooltip && tooltip.length > 0) {
                $(tooltip).tooltipster({
                    interactive: true,
                    theme: ['tooltipster-docker-folder'],
                    trigger: (folder.settings.context_trigger===1 ? 'hover' : 'click') || 'click',
                    zIndex: 99999999,
                    functionBefore: (origin, continueTooltip) => {
                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-before', {detail: {
                            folder: folder,
                            id: id,
                            containerInfo: ct,
                            origin,
                            continueTooltip,
                            charts,
                            stats: {
                                CPU,
                                MEM
                            }
                        }}));
                    },
                    functionReady: (origin, tooltip) => {
                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-ready-start', {detail: {
                            folder: folder,
                            id: id,
                            containerInfo: ct,
                            origin,
                            tooltip,
                            charts,
                            stats: {
                                CPU,
                                MEM
                            }
                        }}));
                        let diabled = [];
                        let active = 0;
                        const options = {
                            scales: {
                                x: {
                                    type: 'realtime',
                                    realtime: {
                                        duration: 1000*(folder.settings.context_graph_time || 60)
                                    },
                                    time: {
                                        tooltipFormat: 'dd MMM, yyyy, HH:mm:ss',
                                        displayFormats: {
                                            millisecond: 'H:mm:ss.SSS',
                                            second: 'H:mm:ss',
                                            minute: 'H:mm',
                                            hour: 'H',
                                            day: 'MMM D',
                                            week: 'll',
                                            month: 'MMM YYYY',
                                            quarter: '[Q]Q - YYYY',
                                            year: 'YYYY'
                                        },
                                    },
                                },
                                y: {
                                    min: 0
                                }
                            },
                            interaction: {
                                intersect: false,
                                mode: 'index',
                            },
                            plugins: {
                                tooltip: {
                                    position: 'nearest'
                                }
                            }
                        };
    
                        switch (folder.settings.context_graph) {
                            case 0:
                                diabled = [0, 1, 2];
                                active = 3;
                                break;
                            case 2:
                                diabled = [0];
                                active = 1;
                                charts.push(new Chart($(`.cpu-grapth-${ct.shortId} > canvas`)[0], {
                                    type: 'line',
                                    data: {
                                        datasets: [
                                            {
                                                label: 'CPU',
                                                data: CPU,
                                                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-cpu'),
                                                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-cpu'),
                                                tension: 0.4,
                                                pointRadius: 0
                                            }
                                        ]
                                    },
                                    options: options
                                }));
                                charts.push(new Chart($(`.mem-grapth-${ct.shortId} > canvas`)[0], {
                                    type: 'line',
                                    data: {
                                        datasets: [
                                            {
                                                label: 'MEM',
                                                data: MEM,
                                                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-mem'),
                                                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-mem'),
                                                tension: 0.4,
                                                pointRadius: 0
                                            }
                                        ]
                                    },
                                    options: options
                                }));
                                break;
                            case 3:
                                diabled = [0, 2];
                                active = 1;
                                charts.push(new Chart($(`.cpu-grapth-${ct.shortId} > canvas`)[0], {
                                    type: 'line',
                                    data: {
                                        datasets: [
                                            {
                                                label: 'CPU',
                                                data: CPU,
                                                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-cpu'),
                                                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-cpu'),
                                                tension: 0.4,
                                                pointRadius: 0
                                            }
                                        ]
                                    },
                                    options: options
                                }));
                                break;
                            case 4:
                                diabled = [0, 1];
                                active = 2;
                                charts.push(new Chart($(`.mem-grapth-${ct.shortId} > canvas`)[0], {
                                    type: 'line',
                                    data: {
                                        datasets: [
                                            {
                                                label: 'MEM',
                                                data: MEM,
                                                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-mem'),
                                                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-mem'),
                                                tension: 0.4,
                                                pointRadius: 0
                                            }
                                        ]
                                    },
                                    options: options
                                }));
                                break;
                            case 1:
                            default:
                                diabled = [1, 2];
                                active = 0;
                                charts.push(new Chart($(`.comb-grapth-${ct.shortId} > canvas`)[0], {
                                    type: 'line',
                                    data: {
                                        datasets: [
                                            {
                                                label: 'CPU',
                                                data: CPU,
                                                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-cpu'),
                                                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-cpu'),
                                                tension: 0.4,
                                                pointRadius: 0
                                            },
                                            {
                                                label: 'MEM',
                                                data: MEM,
                                                borderColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-mem'),
                                                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--folder-view-graph-mem'),
                                                tension: 0.4,
                                                pointRadius: 0
                                            }
                                        ]
                                    },
                                    options: options
                                }));
                                break;
                        };

                        tootltipObserver = new MutationObserver((mutationList, observer) => {
                            for (const mutation of mutationList) {
                                $(`.preview-outbox-${ct.shortId} span#cpu-${ct.shortId}`).css('width',  mutation.target.textContent)
                            }
                        });

                        tootltipObserver.observe($(`.preview-outbox-${ct.shortId} span.cpu-${ct.shortId}`)[0], {childList: true});
    
                        if($(`.preview-outbox-${ct.shortId} .status-autostart`).children().length === 1) {
                            $(`.preview-outbox-${ct.shortId} .status-autostart > input[type='checkbox']`).switchButton({ labels_placement: 'right', off_label: $.i18n('off'), on_label: $.i18n('on'), checked: !(ct.info.State.Autostart === false) });
                            $(`.preview-outbox-${ct.shortId} .info-section`).tabs({
                                heightStyle: 'auto',
                                disabled: diabled,
                                active: active
                            });
                            $(`.preview-outbox-${ct.shortId} table > tbody div.status-autostart > input[type="checkbox"]`).on("change", advancedAutostart);
                        }

    
                        dockerload.addEventListener('message', graphListener);

                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-ready-end', {detail: {
                            folder: folder,
                            id: id,
                            containerInfo: ct,
                            origin,
                            tooltip,
                            charts,
                            tootltipObserver,
                            stats: {
                                CPU,
                                MEM
                            }
                        }}));
                    },
                    functionAfter: (origin) => {
                        folderEvents.dispatchEvent(new CustomEvent('docker-tooltip-after', {detail: {
                            folder: folder,
                            id: id,
                            containerInfo: ct,
                            origin,
                            charts,
                            tootltipObserver,
                            charts,
                            stats: {
                                CPU,
                                MEM
                            }
                        }}));
                        dockerload.removeEventListener('message', graphListener);
                        for (const chart of charts) {
                            chart.destroy();
                        }
                        charts = [];
                        tootltipObserver.disconnect();
                        tootltipObserver = undefined;
                    },
                    content: $(`<div class="preview-outbox-${ct.shortId} preview-outbox"><div class="first-row"><div class="preview-name"><div class="preview-img"><img src="${ct.Labels['net.unraid.docker.icon'] || ''}" class="img folder-img" onerror='this.src="/plugins/dynamix.docker.manager/images/question.png"'></div><div class="preview-actual-name"><span class="blue-text appname">${ct.info.Name}</span><br><i class="fa fa-${ct.info.State.Running ? (ct.info.State.Paused ? 'pause' : 'play') : 'square'} ${ct.info.State.Running ? (ct.info.State.Paused ? 'paused' : 'started') : 'stopped'} ${ct.info.State.Running ? (ct.info.State.Paused ? 'orange-text' : 'green-text') : 'red-text'}"></i><span class="state"> ${ct.info.State.Running ? (ct.info.State.Paused ? $.i18n('paused') : $.i18n('started')) : $.i18n('stopped')}</span></div></div><table class="preview-status"><thead class="status-header"><tr><th class="status-header-version">${$.i18n('version')}</th><th class="status-header-stats">CPU/MEM</th><th class="status-header-autostart">${$.i18n('autostart')}</th></tr></thead><tbody><tr><td><div class="status-version">${!ct.info.State.Updated === false ? `<span class="green-text folder-update-text"><i class="fa fa-check fa-fw"></i>${$.i18n('up-to-date')}</span>${ct.info.State.manager === 'dockerman' ? `<br><a class="exec" onclick="hideAllTips(); updateContainer('${ct.info.Name}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${$.i18n('force-update')}</span></a>` : ''}`:`<span class="orange-text folder-update-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i>${$.i18n('update-ready')}</span><br><a class="exec" onclick="hideAllTips(); updateContainer('${ct.info.Name}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i>${$.i18n('apply-update')}</span></a>`}<br><i class="fa fa-info-circle fa-fw"></i> ${ct.info.Config.Image.split(':').pop()}</div></td><td><div class="status-stats"><span class="cpu-${ct.shortId}">0%</span><div class="usage-disk mm"><span id="cpu-${ct.shortId}" style="width: 0%;"></span><span></span></div><br><span class="mem-${ct.shortId}">0 / 0</span></div></td><td><div class="status-autostart"><input type="checkbox" style="display:none" class="staus-autostart-checkbox"></div></td></tr></tbody></table></div><div class="second-row"><div class="action-info"><div class="action"><div class="action-left"><ul class="fa-ul">${(ct.info.State.Running && !ct.info.State.Paused) ?  `${ct.info.State.WebUi ? `<li><a href="${ct.info.State.WebUi}" target="_blank"><i class="fa fa-globe" aria-hidden="true"></i> ${$.i18n('webui')}</a></li>` : ''}<li><a onclick="event.preventDefault(); openTerminal('docker', '${ct.info.Name}', '${ct.info.Shell}');"><i class="fa fa-terminal" aria-hidden="true"></i> ${$.i18n('console')}</a></li>` : ''}${!ct.info.State.Running ? `<li><a onclick="event.preventDefault(); eventControl({action:'start', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('start')}</a></li>` : `${ct.info.State.Paused ? `<li><a onclick="event.preventDefault(); eventControl({action:'resume', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-play" aria-hidden="true"></i> ${$.i18n('resume')}</a></li>` : `<li><a onclick="event.preventDefault(); eventControl({action:'stop', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-stop" aria-hidden="true"></i> ${$.i18n('stop')}</a></li><li><a onclick="event.preventDefault(); eventControl({action:'pause', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-pause" aria-hidden="true"></i> ${$.i18n('pause')}</a></li>`}<li><a onclick="event.preventDefault(); eventControl({action:'restart', container:'${ct.shortId}'}, 'loadlist');"><i class="fa fa-refresh" aria-hidden="true"></i> ${$.i18n('restart')}</a></li>`}<li><a onclick="event.preventDefault(); openTerminal('docker', '${ct.info.Name}', '.log');"><i class="fa fa-navicon" aria-hidden="true"></i> ${$.i18n('logs')}</a></li>${ct.info.template ? `<li><a onclick="event.preventDefault(); editContainer('${ct.info.Name}', '${ct.info.template.path}');"><i class="fa fa-wrench" aria-hidden="true"></i> ${$.i18n('edit')}</a></li>` : ''}<li><a onclick="event.preventDefault(); rmContainer('${ct.info.Name}', '${ct.shortImageId}', '${ct.shortId}');"><i class="fa fa-trash" aria-hidden="true"></i> ${$.i18n('remove')}</a></li></ul></div><div class="action-right"><ul class="fa-ul">${ct.info.ReadMe ? `<li><a href="${ct.info.ReadMe}" target="_blank"><i class="fa fa-book" aria-hidden="true"></i> ${$.i18n('read-me-first')}</a></li>` : ''}${ct.info.Project ? `<li><a href="${ct.info.Project}" target="_blank"><i class="fa fa-life-ring" aria-hidden="true"></i> ${$.i18n('project-page')}</a></li>` : ''}${ct.info.Support ? `<li><a href="${ct.info.Support}" target="_blank"><i class="fa fa-question" aria-hidden="true"></i> ${$.i18n('support')}</a></li>` : ''}${ct.info.registry ? `<li><a href="${ct.info.registry}" target="_blank"><i class="fa fa-info-circle" aria-hidden="true"></i> ${$.i18n('more-info')}</a></li>` : ''}${ct.info.DonateLink ? `<li><a href="${ct.info.DonateLink}" target="_blank"><i class="fa fa-usd" aria-hidden="true"></i> ${$.i18n('donate')}</a></li>` : ''}</ul></div></div><div class="info-ct"><span class="container-id">${$.i18n('container-id')}: ${ct.shortId}</span><br><span class="repo">${$.i18n('by')}: <a target="_blank" ${ct.info.registry ? `href="${ct.info.registry}"` : ''} >${ct.info.Config.Image.split(':').shift()}</a></span></div></div><div class="info-section"><ul class="info-tabs"><li><a class="tabs-graph" href="#comb-grapth-${ct.shortId}">${$.i18n('graph')}</a></li><li><a class="tabs-cpu-graph" href="#cpu-grapth-${ct.shortId}">${$.i18n('cpu-graph')}</a></li><li><a class="tabs-mem-graph" href="#mem-grapth-${ct.shortId}">${$.i18n('mem-graph')}</a></li><li><a class="tabs-ports" href="#info-ports-${ct.shortId}">${$.i18n('port-mappings')}</a></li><li><a class="tabs-volumes" href="#info-volumes-${ct.shortId}">${$.i18n('volume-mappings')}</a></li></ul><div class="comb-grapth-${ct.shortId} comb-stat-grapth" id="comb-grapth-${ct.shortId}" style="display: none;"><canvas></canvas></div><div class="cpu-grapth-${ct.shortId} cpu-stat-grapth" id="cpu-grapth-${ct.shortId}" style="display: none;"><canvas></canvas></div><div class="mem-grapth-${ct.shortId} mem-stat-grapth" id="mem-grapth-${ct.shortId}" style="display: none;"><canvas></canvas></div><div class="info-ports" id="info-ports-${ct.shortId}" style="display: none;">${ct.info.Ports?.length > 10 ? (`<span class="info-ports-more" style="display: none;">${ct.info.Ports?.map(e=>`${e.PrivateIP}:${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP}:${e.PublicPort}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-ports-less').css('display', 'inline')">${$.i18n('compress')}</a></span><span class="info-ports-less">${ct.info.Ports?.slice(0,10).map(e=>`${e.PrivateIP}:${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP}:${e.PublicPort}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-ports-more').css('display', 'inline')">${$.i18n('expand')}</a></span>`) : (`<span class="info-ports-mono">${ct.info.Ports?.map(e=>`${e.PrivateIP}:${e.PrivatePort}/${e.Type.toUpperCase()} <i class="fa fa-arrows-h"></i> ${e.PublicIP}:${e.PublicPort}`).join('<br>') || ''}</span>`)}</div><div class="info-volumes" id="info-volumes-${ct.shortId}" style="display: none;">${ct.Mounts?.filter(e => e.Type==='bind').length > 10 ? (`<span class="info-volumes-more" style="display: none;">${ct.Mounts?.filter(e => e.Type==='bind').map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-volumes-less').css('display', 'inline')">${$.i18n('compress')}</a></span><span class="info-volumes-less">${ct.Mounts?.filter(e => e.Type==='bind').slice(0,10).map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}<br><a onclick="event.preventDefault(); $(this).parent().css('display', 'none').siblings('.info-volumes-more').css('display', 'inline')">${$.i18n('expand')}</a></span>`) : (`<span class="info-volumes-mono">${ct.Mounts?.filter(e => e.Type==='bind').map(e=>`${e.Destination} <i class="fa fa-arrows-h"></i> ${e.Source}`).join('<br>') || ''}</span>`)}</div></div></div></div>`)
                });
            }

            newFolder[container] = {};
            newFolder[container].id = ct.shortId;
            newFolder[container].pause = ct.info.State.Paused;
            newFolder[container].state = ct.info.State.Running;
            newFolder[container].update = ct.info.State.Updated === false;
            newFolder[container].managed = ct.info.State.manager === 'dockerman';

            if(folderDebugMode) {
                console.log(`${newFolder[container].id}(${offsetIndex}, ${index}) => ${id}`);
            }

            // element to set the preview options
            const element = $(`tr.folder-id-${id} div.folder-preview > span:last`);

            //temp var
            let sel;

            //set the preview option

            if (folder.settings.preview_grayscale) {
                sel = element.children('span.hand').children('img.img');
                if (!sel.length) {
                    sel = element.children('img.img');
                }
                sel.css('filter', 'grayscale(100%)');
            }

            if (folder.settings.preview_update && !ct.info.State.Updated) {
                sel = element.children('span.inner').children('span.appname');
                if (!sel.length) {
                    sel = element.children('span.appname');
                }
                sel.addClass('orange-text');
                sel.children('a.exec').addClass('orange-text');
            }

            if (folder.settings.preview_webui && ct.info.State.WebUi) {
                sel = element.children('span.inner').last();
                if (!sel.length) {
                    sel = element;
                }
                sel.append($(`<span class="folder-element-custom-btn folder-element-webui"><a href="${ct.info.State.WebUi}" target="_blank"><i class="fa fa-globe" aria-hidden="true"></i></a></span>`));
            }

            if (folder.settings.preview_console) {
                sel = element.children('span.inner').last();
                if (!sel.length) {
                    sel = element;
                }
                sel.append($(`<span class="folder-element-custom-btn folder-element-console"><a href="#" onclick="openTerminal('docker', '${ct.info.Name}', '${ct.info.Shell}')"><i class="fa fa-terminal" aria-hidden="true"></i></a></span>`));
            }

            if (folder.settings.preview_logs) {
                sel = element.children('span.inner').last();
                if (!sel.length) {
                    sel = element;
                }
                sel.append($(`<span class="folder-element-custom-btn folder-element-logs"><a href="#" onclick="openTerminal('docker', '${container}', '.log')"><i class="fa fa-bars" aria-hidden="true"></i></a></span>`));
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

    // set the border on the last element
    $(`.folder-${id}-element:last`).css('border-bottom', `1px solid ${folder.settings.preview_border_color}`);

    // replace the old containers array with the newFolder object
    folder.containers = newFolder;

    $(`tr.folder-id-${id} div.folder-storage span.outer`).get().forEach((e) => {
        folderobserver.observe(e, folderobserverConfig);
    });

    // wrap the preview with a div
    $(`tr.folder-id-${id} div.folder-preview > span`).wrap('<div class="folder-preview-wrapper"></div>');

    if(folder.settings.preview_vertical_bars) {
        $(`tr.folder-id-${id} div.folder-preview > div`).after(`<div class="folder-preview-divider" style="border-color: ${folder.settings.preview_border_color};"></div>`);
    }

    if(folder.settings.update_column) {
        $(`tr.folder-id-${id} > td.updatecolumn`).next().attr('colspan',6).end().remove();
    }

    if(managed === 0) {
        $(`tr.folder-id-${id} > td.updatecolumn > div.advanced`).remove();
    }

    //set tehe status of a folder

    if (!upToDate) {
        $(`tr.folder-id-${id} > td.updatecolumn > span`).replaceWith($(`<div class="advanced" style="display: ${advanced ? 'block' : 'none'};"><span class="orange-text folder-update-text" style="white-space:nowrap;"><i class="fa fa-flash fa-fw"></i> ${$.i18n('update-ready')}</span></div>`));
        $(`tr.folder-id-${id} > td.updatecolumn > div.advanced:has(a)`).remove();
        $(`tr.folder-id-${id} > td.updatecolumn`).append($(`<a class="exec" onclick="updateFolder('${id}');"><span style="white-space:nowrap;"><i class="fa fa-cloud-download fa-fw"></i> ${$.i18n('apply-update')}</span></a>`));
    }

    if (started) {
        $(`tr.folder-id-${id} i#load-folder-${id}`).attr('class', 'fa fa-play started green-text folder-load-status');
        $(`tr.folder-id-${id} span.folder-state`).text(`${started}/${Object.entries(folder.containers).length} ${$.i18n('started')}`);
    }

    if (autostart) {
        $(`#folder-${id}-auto`).next().click();
    }

    if(autostart === 0) {
        $(`tr.folder-id-${id}`).addClass('no-autostart');
    } else if (autostart > 0 && autostartStarted === 0) {
        $(`tr.folder-id-${id}`).addClass('autostart-off');
    } else if (autostart > 0 && autostartStarted > 0 && autostart !== autostartStarted) {
        $(`tr.folder-id-${id}`).addClass('autostart-partial');
    } else if (autostart > 0 && autostartStarted > 0 && autostart === autostartStarted) {
        $(`tr.folder-id-${id}`).addClass('autostart-full');
    }

    if(managed === 0) {
        $(`tr.folder-id-${id}`).addClass('no-managed');
    } else if (managed > 0 && managed < Object.values(folder.containers).length) {
        $(`tr.folder-id-${id}`).addClass('managed-partial');
    } else if (managed > 0 && managed === Object.values(folder.containers).length) {
        $(`tr.folder-id-${id}`).addClass('managed-full');
    }

    // set the status
    folder.status = {};
    folder.status.upToDate = upToDate;
    folder.status.started = started;
    folder.status.autostart = autostart;
    folder.status.autostartStarted = autostartStarted;
    folder.status.managed = managed;
    folder.status.expanded = false;

    // add the function to handle the change on the autostart checkbox, this is here because of the if before, i don't want to handle the change i triggered before
    $(`#folder-${id}-auto`).on("change", folderAutostart);

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
 * Function to hide all tooltips
 */
const hideAllTips = () => {
    let tips = $.tooltipster.instances();
    $.each(tips, function(i, instance){
        instance.close();
    });
};

/**
 * Function to set the atuostart of a container in the advanced tooltip
 * @param {*} el element passed by the event caller
 */
const advancedAutostart = (el) => {
    const outbox = $(el.target).parents('.preview-outbox')[0];
    const ctid = outbox.className.match(/preview-outbox-[a-zA-Z0-9]*/)[0].replace('preview-outbox-', '');
    $(`#${ctid}`).parents('.folder-element').find('.switch-button-background').click();
};

/**
 * Hanled the click of the autostart button and changes the container to reflect the status of the folder
 * @param {*} el element passed by the event caller
 */
const folderAutostart = (el) => {
    const status = el.target.checked;
    // The id is needded to get the containers, the checkbox has a id folder-${id}-auto, so split and take the second element
    const id = el.target.id.split('-')[1];
    const containers = $(`.folder-${id}-element`);
    for (const container of containers) {
        // Select the td with the switch inside
        const el = $(container).children('td.advanced').next();

        // Get the status of the container
        const cstatus = el.children('.autostart')[0].checked;
        if ((status && !cstatus) || (!status && cstatus)) {
            el.children('.switch-button-background').click();
        }
    }
};

/**
 * Handle the dropdown expand button of folders
 * @param {string} id the id of the folder
 */
const dropDownButton = (id) => {
    folderEvents.dispatchEvent(new CustomEvent('docker-pre-folder-expansion', {detail: { id }}));
    const element = $(`.dropDown-${id}`);
    const state = element.attr('active') === "true";
    if (state) {
        element.children().removeClass('fa-chevron-up').addClass('fa-chevron-down');
        $(`tr.folder-id-${id}`).addClass('sortable');
        $(`tr.folder-id-${id} .folder-storage`).append($(`.folder-${id}-element`));
        element.attr('active', 'false');
    } else {
        element.children().removeClass('fa-chevron-down').addClass('fa-chevron-up');
        $(`tr.folder-id-${id}`).removeClass('sortable').removeClass('ui-sortable-handle').off().css('cursor', '');
        $(`tr.folder-id-${id}`).after($(`.folder-${id}-element`));
        $(`.folder-${id}-element > td > i.fa-arrows-v`).remove();
        element.attr('active', 'true');
    }
    if(globalFolders[id]) {
        globalFolders[id].status.expanded = !state;
    }
    folderEvents.dispatchEvent(new CustomEvent('docker-post-folder-expansion', {detail: { id }}));
};

/**
 * Removie the folder
 * @param {string} id the id of the folder
 */
const rmFolder = (id) => {
    // Ask for a confirmation
    swal({
        title: $.i18n('are-you-sure'),
        text: `${$.i18n('remove-folder')}: ${globalFolders[id].name}`,
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
        await $.get('/plugins/folder.view/server/delete.php?type=docker&id=' + id).promise();
        setTimeout(loadlist(), 500)
    });
};

/**
 * Redirect to the page to edit the folder
 * @param {string} id the id of the folder
 */
const editFolder = (id) => {
    location.href = "/Docker/Folder?type=docker&id=" + id;
};

/**
 * Force update all the containers inside a folder
 * @param {string} id the id of the folder
 */
const forceUpdateFolder = (id) => {
    hideAllTips();
    const folder = globalFolders[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Update all the updatable containers inside a folder
 * @param {string} id the id of the folder
 */
const updateFolder = (id) => {
    hideAllTips();
    const folder = globalFolders[id];
    openDocker('update_container ' + Object.entries(folder.containers).filter(([k, v]) => v.managed && v.update).map(e => e[0]).join('*'), $.i18n('updating', folder.name),'','loadlist');
};

/**
 * Perform an action for the entire folder
 * @param {string} id The id of the folder
 * @param {string} action the desired action
 */
const actionFolder = async (id, action) => {
    const folder = globalFolders[id];
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
            case "restart":
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
};

/**
 * Execute the desired custom action
 * @param {string} id 
 * @param {number} action 
 */
const folderCustomAction = async (id, action) => {
    $('div.spinner.fixed').show('slow');
    const folder = globalFolders[id];
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
    let opts = [];

    context.settings({
        right: false,
        above: false
    });

    if(globalFolders[id].settings.override_default_actions && globalFolders[id].actions && globalFolders[id].actions.length) {
        opts.push(
            ...globalFolders[id].actions.map((e, i) => {
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

    } else if(!globalFolders[id].settings.default_action) {
        opts.push({
            text: $.i18n('start'),
            icon: 'fa-play',
            action: (e) => { e.preventDefault(); actionFolder(id, "start"); }
        });
        opts.push({
            text: $.i18n('stop'),
            icon: 'fa-stop',
            action: (e) => { e.preventDefault(); actionFolder(id, "stop"); }
        });
        
        opts.push({
            text: $.i18n('pause'),
            icon: 'fa-pause',
            action: (e) => { e.preventDefault(); actionFolder(id, "pause"); }
        });
    
        opts.push({
            text: $.i18n('resume'),
            icon: 'fa-play-circle',
            action: (e) => { e.preventDefault(); actionFolder(id, "resume"); }
        });
    
        opts.push({
            text: $.i18n('restart'),
            icon: 'fa-refresh',
            action: (e) => { e.preventDefault(); actionFolder(id, "restart"); }
        });
    
        opts.push({
            divider: true
        });
    }

    if(globalFolders[id].status.managed > 0) {
        if(!globalFolders[id].status.upToDate) {
            opts.push({
                text: $.i18n('update'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault();  updateFolder(id); }
            });
        } else {
            opts.push({
                text: $.i18n('update-force'),
                icon: 'fa-cloud-download',
                action: (e) => { e.preventDefault(); forceUpdateFolder(id); }
            });
        }

        opts.push({
            divider: true
        });
    }

    opts.push({
        text: $.i18n('edit'),
        icon: 'fa-wrench',
        action: (e) => { e.preventDefault(); editFolder(id); }
    });

    opts.push({
        text: $.i18n('remove'),
        icon: 'fa-trash',
        action: (e) => { e.preventDefault(); rmFolder(id); }
    });

    if(!globalFolders[id].settings.override_default_actions && globalFolders[id].actions && globalFolders[id].actions.length) {
        opts.push({
            divider: true
        });

        opts.push({
            text: $.i18n('custom-actions'),
            icon: 'fa-bars',
            subMenu: globalFolders[id].actions.map((e, i) => {
                return {
                    text: e.name,
                    icon: e.script_icon || "fa-bolt",
                    action: (e) => { e.preventDefault(); folderCustomAction(id, i); }
                }
            })
        });
    }

    folderEvents.dispatchEvent(new CustomEvent('docker-folder-context', {detail: { id, opts }}));

    context.attach('#' + id, opts);
};

// Patching the original function to make sure the containers are rendered before insering the folder
window.listview_original = listview;
window.listview = () => {
    listview_original();
    if (!loadedFolder) {
        createFolders();
        loadedFolder = true;
    }
};

window.loadlist_original = loadlist;
window.loadlist = () => {
    loadedFolder = false;
    folderReq = [
        // Get the folders
        $.get('/plugins/folder.view/server/read.php?type=docker').promise(),
        // Get the order as unraid sees it
        $.get('/plugins/folder.view/server/read_order.php?type=docker').promise(),
        // Get the info on containers, needed for autostart, update and started
        $.get('/plugins/folder.view/server/read_info.php?type=docker').promise(),
        // Get the order that is shown in the webui
        $.get('/plugins/folder.view/server/read_unraid_order.php?type=docker').promise()
    ];
    loadlist_original();
};

// Get the number of CPU, nneded for a right display of the load
$.get('/plugins/folder.view/server/cpu.php').promise().then((data) => {
    cpus = parseInt(data);
    // Attach to the scoket and process the data
    dockerload.addEventListener('message', (e) => {
        let load = {};
        e.split('\n').forEach((e) => {
            const exp = e.split(';');
            load[exp[0]] = {
                cpu: exp[1],
                mem: exp[2].split(' / ')
            };
        });
        for (const [id, value] of Object.entries(globalFolders)) {
            let loadCpu = 0;
            let totalMem = 0;
            let loadMem = 0;
            for (const [cid, cvalue] of Object.entries(value.containers)) {
                const curLoad = load[cvalue.id] || { cpu: '0.00%', mem: ['0B', '0B'] };
                loadCpu += parseFloat(curLoad.cpu.replace('%', ''))/cpus;
                loadMem += memToB(curLoad.mem[0]);
                let tempTotalMem = memToB(curLoad.mem[1]);
                totalMem = (tempTotalMem > totalMem) ? tempTotalMem : totalMem;
            }
            $(`span.mem-folder-${id}`).text(`${bToMem(loadMem)} / ${bToMem(totalMem)}`);
            $(`span.cpu-folder-${id}`).text(`${loadCpu.toFixed(2)}%`);
            $(`span#cpu-folder-${id}`).css('width', `${loadCpu.toFixed(2)}%`)
        }
    });
});

/**
 * Convert memory unit to Bytes
 * @param {string} mem the unraid memory notation
 * @returns {number} number of bytes
 */
const memToB = (mem) => {
    const unit = mem.match(/[a-zA-Z]/g).join('');
    mem = parseFloat(mem.replace(unit, ''));
    let loadMem = 0;
    switch (unit) {
        case 'KiB':
            loadMem += (2 ** 10) * mem;
            break;
        case 'MiB':
            loadMem = (2 ** 20) * mem;
            break;
        case 'GiB':
            loadMem = (2 ** 30) * mem;
            break;
        case 'TiB':
            loadMem = (2 ** 40) * mem;
            break;
        case 'PiB':
            loadMem = (2 ** 50) * mem;
            break;
        case 'EiB':
            loadMem = (2 ** 60) * mem;
            break;
        case 'ZiB':
            loadMem = (2 ** 70) * mem;
            break;
        case 'YiB':
            loadMem = (2 ** 80) * mem;
            break;
        default:
            loadMem = 1 * mem;
            break;
    }
    return loadMem;
};

/**
 * Convert Bytes to memory units
 * @param {number} b the number of bytes
 * @returns {string} a string with the right notation and right unit
 */
const bToMem = (b) => {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let index = 0;
    while (b >= 1024) {
        b /= 1024;
        index++;
    }
    return b.toFixed(2) + units[index];
};

// Global variables
let cpus = 1;
let loadedFolder = false;
let globalFolders = {};
const folderRegex = /^folder-/;
let folderDebugMode = false;
let folderDebugModeWindow = [];
let folderobserver;
let folderobserverConfig = {
    subtree: true,
    attributes: true
};
let folderReq = [];

// Add the button for creating a folder
const createFolderBtn = () => { location.href = "/Docker/Folder?type=docker" };

// This is needed because unraid don't like the folder and the number are set incorrectly, this intercept the request and change the numbers to make the order appear right, this is important for the autostart and to draw the folders
$.ajaxPrefilter((options, originalOptions, jqXHR) => {
    if (options.url === "/plugins/dynamix.docker.manager/include/UserPrefs.php") {
        const data = new URLSearchParams(options.data);
        const containers = data.get('names').split(';');
        let num = "";
        for (let index = 0; index < containers.length - 1; index++) {
            num += index + ';'
        }
        data.set('index', num);
        options.data = data.toString();
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
