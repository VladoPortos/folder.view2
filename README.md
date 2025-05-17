# FolderView2 For Unraid 7

## What is FolderView2?

Original creator: [**scolcipitato**](https://github.com/scolcipitato/folder.view)

FolderView2 lets you create folders for grouping Dockers and VMs together to help with organization. Especially useful if you're using docker-compose.
Getting Started: A new button named "Add Folder" will appear at the bottom of the docker/VM tab next to "Add Container/VM".

## Installation

You can find the FolderView2 in official Unraid app store.

### Backup
If you already have this plugins older version setup go to Plugins -> FolderView and "Export All" your current settings!

However if you arelady can't access FolderView go to Settings via UI, go to:

`config\plugins\folder.view\` and backup: `docker.json` and `vm.json` 

```bash
root@PlexServer:/boot/config/plugins/folder.view# pwd
/boot/config/plugins/folder.view
root@PlexServer:/boot/config/plugins/folder.view# ls
docker.json  folder.view2-2025.02.26.txz  scripts/  styles/  version  vm.json
root@PlexServer:/boot/config/plugins/folder.view# 
```

### Easy Manual installation

Use link: https://raw.githubusercontent.com/VladoPortos/folder.view2/refs/heads/main/folder.view2.plg

That link can be posted directly into the plugin install without needing to copy it to the filesystem beforehand.

[![Install FolderView2](img/plugin_install.png)]


### Manual installation
1. Copy the `folder.view2.plg` file to `/boot/config/plugins/` folder.
2. Copy the latest 'folder.view2-<date>.txz' from archive folder to `/boot/config/plugins/folder.view2/` folder.
3. In Unraid webui go to Plugins -> Install Plugin tab, click on the folder `config` -> `plugins` -> `folder.view2.plg` and press install button.

## Support & Feedback
If you have any questions or issues, please file an issue on [GitHub](https://github.com/VladoPortos/folder.view2/issues).

## Contributors
- [TurboStreetCar](https://github.com/TurboStreetCar) - Contributed improved folder.js implementation for compatibility with Unraid 7 and older versions

---

## ☕ Buy Me a Coffee (or a Beer!)

If you like this project and want to support my caffeine-fueled coding sessions, you can buy me a coffee (or a beer, I won't judge! 🍻) on Ko-fi:

[![Support me on Ko-fi](img/support_me_on_kofi_badge_red.png)](https://ko-fi.com/vladoportos)

Every donation helps to proofe to my wife that I'm not a complete idiot :D

---

### Libraries used in this project:
- [Chart.js](https://www.chartjs.org/)
- [chartjs-adapter-moment](https://github.com/chartjs/chartjs-adapter-moment)
- [Moment.js](https://momentjs.com/)
- [chartjs-plugin-streaming](https://github.com/nagix/chartjs-plugin-streaming)
- [jquery.i18n](https://github.com/wikimedia/jquery.i18n)
- [jQuery UI MultiSelect](https://github.com/ehynds/jquery-ui-multiselect-widget)
