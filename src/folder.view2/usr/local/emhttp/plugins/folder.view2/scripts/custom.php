<?php
    require_once("/usr/local/emhttp/plugins/folder.view2/server/lib.php");
    $scripts = dirToArrayOfFiles(pathToMultiDimArray('/boot/config/plugins/folder.view2/scripts'), "/\..*{$type}.*\.js$/", "/.*\.disabled$/");
    foreach ($scripts as $script) {
        echo "<script src=\"";
        autov($script['path']);
        echo "\"></script>";
    }
?>