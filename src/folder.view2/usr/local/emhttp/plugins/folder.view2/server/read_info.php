<?php
    require_once("/usr/local/emhttp/plugins/folder.view2/server/lib.php");
    echo json_encode(readInfo($_GET['type']));
?>