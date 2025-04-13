<?php
    $folderVersion = 1.0;
    $configDir = "/boot/config/plugins/folder.view2";
    $sourceDir = "/usr/local/emhttp/plugins/folder.view2";
    $documentRoot = $_SERVER['DOCUMENT_ROOT'] ?? '/usr/local/emhttp';
    require_once("$documentRoot/plugins/dynamix.docker.manager/include/DockerClient.php");
    require_once ("$documentRoot/webGui/include/Helpers.php");
    require_once ("$documentRoot/plugins/dynamix.vm.manager/include/libvirt_helpers.php");


    function readFolder(string $type) : string {
        global $configDir;
        if(!file_exists("$configDir/$type.json")) {
            createFile($type);
        }

        return file_get_contents("$configDir/$type.json");
    }

    function readUserPrefs(string $type) : string {
        $userPrefs = "/boot/config/plugins";
        if($type == 'docker') {
            $userPrefs = "$userPrefs/dockerMan/userprefs.cfg";
            if(!file_exists($userPrefs)) {
                return '[]';
            }
        } else if($type == 'vm') {
            $userPrefs = "$userPrefs/dynamix.vm.manager/userprefs.cfg";
            if(!file_exists($userPrefs)) {
                return '[]';
            }
        } else {
            return '[]';
        }

        return json_encode(parse_ini_file($userPrefs));
    }
    
    // Used for create without passing the id
    function updateFolder(string $type, string $content, string $id = '') : void {
        global $configDir;
        if(!file_exists("$configDir/$type.json")) {
            createFile($type);
            $id = generateId();
        }
        if($id == '') {
            $id = generateId();
        }
        $file = json_decode(file_get_contents("$configDir/$type.json"), true);
        $file[$id] = json_decode($content, true);
        file_put_contents("$configDir/$type.json", json_encode($file));
    }

    function deleteFolder(string $type, string $id) : void {
        global $configDir;
        if(!file_exists("$configDir/$type.json")) {
            createFile($type);
        }
        $file = json_decode(file_get_contents("$configDir/$type.json"), true);
        unset($file[$id]);
        file_put_contents("$configDir/$type.json", json_encode($file));
    }

    function generateId(int $length = 20) : string {
        return str_replace(['+', '/', '='], '', base64_encode(random_bytes(20)));
    }

    function createFile(string $type): void {
        global $configDir;
        $default = [
            'docker' => '{}',
            'vm' => '{}',
        ];
        file_put_contents("$configDir/$type.json", $default[$type]);
    }

    function readInfo(string $type): array {
        $info = [];
        if ($type == "docker") {
            global $dockerManPaths;
            global $driver;
            global $host;
            $dockerClient = new DockerClient();
            $DockerUpdate = new DockerUpdate();
            $dockerTemplates = new DockerTemplates();
            $cts = $dockerClient->getDockerJSON("/containers/json?all=1");
            $autoStart = array_map('var_split', file($dockerManPaths['autostart-file'],FILE_IGNORE_NEW_LINES) ?: []);
            $templates = $dockerTemplates->getTemplates('all');
            foreach($templates as &$tmp) {
                $doc = new DOMDocument();
                $doc->load($tmp['path']??'');
                $tmp['image'] = DockerUtil::ensureImageTag($doc->getElementsByTagName('Repository')->item(0)->nodeValue??'');
                $tmp['WebUi'] = trim($doc->getElementsByTagName('WebUI')->item(0)->nodeValue??'');
                $tmp['Name'] = trim($doc->getElementsByTagName('Name')->item(0)->nodeValue??'');
                $tmp['registry'] = trim($doc->getElementsByTagName('Registry')->item(0)->nodeValue??'');
                $tmp['Support'] = trim($doc->getElementsByTagName('Support')->item(0)->nodeValue??'');
                $tmp['Project'] = trim($doc->getElementsByTagName('Project')->item(0)->nodeValue??'');
                $tmp['DonateLink'] = trim($doc->getElementsByTagName('DonateLink')->item(0)->nodeValue??'');
                $tmp['ReadMe'] = trim($doc->getElementsByTagName('ReadMe')->item(0)->nodeValue??'');
                $tmp['Shell'] = trim($doc->getElementsByTagName('Shell')->item(0)->nodeValue??'');
            }
            foreach ($cts as $key => &$ct) {
                $ct['info'] = $dockerClient->getContainerDetails($ct['Id']);

                $ct['info']['Name'] = substr($ct['info']['Name'], 1);
                $ct['info']['State']['Autostart'] = array_search($ct['info']['Name'], $autoStart);
                $ct['info']['Config']['Image'] = DockerUtil::ensureImageTag($ct['info']['Config']['Image']);
                $ct['info']['State']['Updated'] = $DockerUpdate->getUpdateStatus($ct['info']['Config']['Image']);
                $ct['info']['State']['manager'] = $ct['Labels']['net.unraid.docker.managed'] ?? false;
                $template = array_filter($templates, function($el) use ($ct) {
                    return $el['image'] == $ct['info']['Config']['Image'] && $el['Name'] == $ct['info']['Name'];
                });
                $template = $template[array_key_first($template)];
                if($ct['Labels']['net.unraid.docker.managed'] == 'dockerman' && !is_null($template)) {
                    $ct['info']['State']['WebUi'] = $template['WebUi'];
                    $ct['info']['registry'] = $template['registry'];
                    $ct['info']['Support'] = $template['Support'];
                    $ct['info']['Project'] = $template['Project'];
                    $ct['info']['DonateLink'] = $template['DonateLink'];
                    $ct['info']['ReadMe'] = $template['ReadMe'];
                    $ct['info']['Shell'] = $template['Shell'];
                    $ct['info']['template'] = $template;
                } else {
                    $ct['info']['State']['WebUi'] = $ct['Labels']['net.unraid.docker.webui'] ?? '';
                    $ct['info']['Shell'] = $ct['Labels']['net.unraid.docker.shell'] ?? '';
                }

                // extractID in /usr/local/emhttp/plugins/dynamix.docker.manager/include/DockerClient.php edited
                $ct['shortId'] = substr(str_replace('sha256:', '', $ct['Id']), 0, 12);
                $ct['shortImageId'] = substr(str_replace('sha256:', '', $ct['ImageID']), 0, 12);

                // getDockerContainers in /usr/local/emhttp/plugins/dynamix.docker.manager/include/DockerClient.php edited
                [$net, $id] = array_pad(explode(':',$ct['HostConfig']['NetworkMode']),2,'');
                if ($id) $ct['HostConfig']['NetworkMode'] = $net.str_replace('/',':',DockerUtil::ctMap($id)?:'/???');
                if (isset($driver[$ct['HostConfig']['NetworkMode']])) {
                    if ($driver[$ct['HostConfig']['NetworkMode']]=='bridge') {
                        $ports = &$ct['info']['HostConfig']['PortBindings'];
                        $nat = true;
                    } else {
                        $ports = &$ct['info']['Config']['ExposedPorts'];
                        $nat = false;
                    }
                } else if (!$id) {
                    $ct['HostConfig']['NetworkMode'] = DockerUtil::ctMap($ct['HostConfig']['NetworkMode']);
                    $ports = &$ct['info']['Config']['ExposedPorts'];
                    $nat = false;
                }
                $ip = ($driver[$ct['HostConfig']['NetworkMode']]=='bridge' || $ct['HostConfig']['NetworkMode']=='host') ? $host : $ct['NetworkSettings']['Networks'][$ct['HostConfig']['NetworkMode']]['IPAddress'] ?? $host;
                $ports = (isset($ports) && is_array($ports)) ? $ports : [];
                foreach ($ports as $port => $value) {
                    [$PrivatePort, $PType] = array_pad(explode('/', $port),2,'');
                    $ct['info']['Ports'][] = ['PrivateIP' => $ip, 'PrivatePort' => $PrivatePort, 'PublicIP' => $nat ? $host : $ip,'PublicPort' => $nat ? $value[0]['HostPort'] : $PrivatePort, 'NAT' => $nat, 'Type' => $PType];
                }

                if (strlen($ct['info']['State']['WebUi']) > 0 && preg_match("%\[(IP|PORT:(\d+))\]%", $ct['info']['State']['WebUi'])) {
                    $ConfigPort = "";
                    if (preg_match("%\[PORT:(\d+)\]%", $ct['info']['State']['WebUi'], $matches)) {
                        $ConfigPort = $matches[1] ?? '';
                        foreach ($ct['info']['Ports'] as $port) {
                            if($port['PrivatePort'] == $ConfigPort) {
                                $ConfigPort = $port;
                                break;
                            }
                        }
                    }
                    
                    if(is_array($ConfigPort)) {
                        $ct['info']['State']['WebUi'] = preg_replace("%\[PORT:\d+\]%", $ConfigPort['PublicPort'], $ct['info']['State']['WebUi']);
                        $ct['info']['State']['WebUi'] = preg_replace("%\[IP\]%", $nat ? $host : $ConfigPort['PublicIP'], $ct['info']['State']['WebUi']);
                    } else {
                        $ct['info']['State']['WebUi'] = preg_replace("%\[PORT:\d+\]%", $ConfigPort, $ct['info']['State']['WebUi']);
                        $ct['info']['State']['WebUi'] = preg_replace("%\[IP\]%", $nat ? $host : $ip, $ct['info']['State']['WebUi']);
                    }
                }

                $info[$ct['info']['Name']] = $ct;
            }
        } elseif ($type == "vm") {
            global $lv;
            $vms = $lv->get_domains();
            if (!empty($vms)) {
                foreach ($vms as $vm) {
                    $res = $lv->get_domain_by_name($vm);
                    $dom = $lv->domain_get_info($res);
                    $info[$vm] = [
                        'uuid' => $lv->domain_get_uuid($res),
                        'name' => $vm,
                        'description' => $lv->domain_get_description($res),
                        'autostart' => $lv->domain_get_autostart($res),
                        'state' => $lv->domain_state_translate($dom['state']),
                        'icon' => $lv->domain_get_icon_url($res),
                        'logs' => (is_file("/var/log/libvirt/qemu/$vm.log") ? "libvirt/qemu/$vm.log" : '')
                    ];
                }
            }
        }
        return $info;
    }

    function readUnraidOrder(string $type): array {
        $user_prefs = "/boot/config/plugins";
        $order = [];
        if ($type == "docker") {
            // /usr/local/emhttp/plugins/dynamix.docker.manager/include/DockerContainers.php
            $dockerClient = new DockerClient();
            $containers = $dockerClient->getDockerContainers();
            $user_prefs = "$user_prefs/dockerMan/userprefs.cfg";

            if (file_exists($user_prefs)) {
                $prefs = array_values(parse_ini_file($user_prefs)) ?: [];
                $sort = [];
                foreach ($containers as $ct)  {
                    $sort[] = array_search($ct['Name'],$prefs);
                }
                array_multisort($sort,SORT_NUMERIC,$containers);
                unset($sort);
            }

            foreach ($containers as $index=>$ct)  {
                $containers[$index] = $ct['Name'];
            }
            
            $order = $containers;
        } elseif ($type == "vm") {
            global $lv;
            // /usr/local/emhttp/plugins/dynamix.vm.manager/include/VMMachines.php
            $user_prefs = "$user_prefs/dynamix.vm.manager/userprefs.cfg";
            $vms = $lv->get_domains();

            if (!empty($vms)) {
                if (file_exists($user_prefs)) {
                    $prefs = parse_ini_file($user_prefs) ?: [];
                    $sort = [];
                    foreach ($vms as $vm) {
                        $sort[] = array_search($vm,$prefs);
                    }
                    array_multisort($sort,SORT_NUMERIC,$vms);
                    unset($sort);
                } else {
                    natcasesort($vms);
                }

                $order = array_values($vms);
            }
        }
        return $order;
    }

    function pathToMultiDimArray($dir) {
        $final = [];
        try {
            $elements = array_diff(scandir($dir), ['.', '..']);
            foreach ($elements as $el) {
                $newEl = "{$dir}/{$el}";
                if(is_dir($newEl)) {
                    array_push($final, [
                        "name" => $el,
                        "path" => $newEl,
                        "sub" => pathToMultiDimArray($newEl)
                    ]);
                } else if(is_file($newEl)) {
                    array_push($final, [
                        "name" => $el,
                        "path" => $newEl
                    ]);
                }
            }
        } catch (Throwable $err) {}
        return $final;
    }

    function dirToArrayOfFiles($dir, $fileFilter = NULL, $folderFilter = NULL) {
        $final = [];
        foreach ($dir as $el) {
            if(isset($el['sub']) && (!isset($folderFilter) || (isset($folderFilter) && !preg_match($folderFilter, $el['name'])))) {
                $final = array_merge($final, dirToArrayOfFiles($el['sub'], $fileFilter, $folderFilter));
            } else if(!isset($fileFilter) || (isset($fileFilter) && preg_match($fileFilter, $el['name']))) {
                array_push($final, $el);
            }
        }
        return $final;
    }
?>