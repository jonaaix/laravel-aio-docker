# Adding Chromium PDF

Chromium is included in the `1.3` images, so you can use it to generate PDFs in your Laravel application.

Install the packages `spatie/laravel-pdf` and `spatie/browsershot` and configure them to use the `chrome` driver.

```shell
composer require spatie/laravel-pdf spatie/browsershot
npm install -S puppeteer
```

```php
<?php

namespace App\Services;

use Spatie\Browsershot\Browsershot;
use Spatie\LaravelPdf\PdfBuilder;

class PDF
{
    /**
     * Get printer instance.
     */
    public static function getPrinter(): PdfBuilder
    {
        return \Spatie\LaravelPdf\Support\pdf()->withBrowsershot(function (Browsershot $browsershot) {
            $browsershot->setOption('executablePath', '/usr/bin/chromium-browser');
        });
    }
}
```

The Chromium binary is at `/usr/bin/chromium-browser` (the `PUPPETEER_EXECUTABLE_PATH` env var is set to the same path inside the container).
