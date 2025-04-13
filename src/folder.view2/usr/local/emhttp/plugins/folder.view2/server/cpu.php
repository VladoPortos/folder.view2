<?php
    echo (int) shell_exec("cat /proc/cpuinfo | grep processor | wc -l");
?>