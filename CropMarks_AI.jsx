#target "illustrator"

// ============================================================
// CropMarks_AI.jsx - Метки реза для Illustrator
// ============================================================
//
// Разработчики:
//   Yurec <yurec923@gmail.com>
// Версия: 2.1 (финал)
// Дата: Июль 2026
//
// ============================================================

// ============================================
// === ПОЛИФИЛ ДЛЯ .trim() ===
// ============================================

if (!String.prototype.trim) {
    String.prototype.trim = function() {
        return this.replace(/^\s+|\s+$/g, '');
    };
}

// ============================================
// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УВЕДОМЛЕНИЙ ===
// ============================================

function showMessage(msg, silent) {
    if (!silent) {
        alert(msg);
    }
}

function showWarning(msg) {
    alert("⚠️ " + msg);
}

// ============================================
// === МОДУЛЬ НАСТРОЕК ===
// ============================================

var Settings = {
    _file: null,
    
    init: function() {
        try {
            var myDocuments = Folder.myDocuments;
            var settingsFolder = new Folder(myDocuments + "/Illustrator/Scripts");
            if (!settingsFolder.exists) {
                settingsFolder.create();
            }
            var settingsPath = settingsFolder.fsName + "/cropmarks_settings.txt";
            this._file = new File(settingsPath);
            
            if (!this._file.exists) {
                this._file.open("w");
                this._file.write("");
                this._file.close();
            }
            return;
        } catch (e) {
            try {
                var tempFolder = Folder.temp;
                var settingsPath = tempFolder.fsName + "/cropmarks_settings.txt";
                this._file = new File(settingsPath);
            } catch (e2) {
                this._file = null;
            }
        }
    },
    
    parseSettings: function(str) {
        var settings = {};
        if (!str) return settings;
        
        var lines = str.split("\n");
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/\r/g, "");
            if (line.indexOf("=") > -1) {
                var parts = line.split("=");
                var key = parts[0].trim();
                var value = parts[1].trim();
                
                if (value === "true") settings[key] = true;
                else if (value === "false") settings[key] = false;
                else if (value === "null") settings[key] = null;
                else if (!isNaN(value) && value !== "") settings[key] = parseFloat(value);
                else settings[key] = value;
            }
        }
        return settings;
    },
    
    stringifySettings: function(settings) {
        var lines = [];
        for (var key in settings) {
            if (settings.hasOwnProperty(key)) {
                var value = settings[key];
                if (typeof value === "string") {
                    lines.push(key + "=" + value);
                } else {
                    lines.push(key + "=" + String(value));
                }
            }
        }
        return lines.join("\n");
    },
    
    load: function() {
        this.init();
        if (!this._file) return null;
        
        try {
            if (this._file.exists) {
                this._file.open("r");
                var data = this._file.read();
                this._file.close();
                
                var settings = this.parseSettings(data);
                return settings;
            }
        } catch (e) {}
        return null;
    },
    
    save: function(settings) {
        this.init();
        if (!this._file) return false;
        
        try {
            var data = this.stringifySettings(settings);
            this._file.open("w");
            this._file.write(data);
            this._file.close();
            return true;
        } catch (e) {
            return false;
        }
    }
};

// ============================================
// === МОДУЛЬ КООРДИНАТ ===
// ============================================

var Coord = {
    init: function() {
        try {
            if (typeof app.coordinateSystem !== 'undefined') {
                this._oldCoordinateSystem = app.coordinateSystem;
                app.coordinateSystem = CoordinateSystem.ARTBOARDCOORDINATESYSTEM;
            }
        } catch (e) {}
    },
    
    restore: function() {
        try {
            if (this._oldCoordinateSystem !== undefined && this._oldCoordinateSystem !== null) {
                app.coordinateSystem = this._oldCoordinateSystem;
            }
        } catch (e) {}
    },
    
    point: function(x, y) {
        return { x: x, y: y };
    },
    
    rect: function(left, top, right, bottom) {
        var w = right - left;
        var h = top - bottom;
        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: w,
            height: h,
            cx: left + (w / 2),
            cy: top + (h / 2)
        };
    },
    
    getBounds: function(item) {
        var b = item.visibleBounds;
        return this.rect(b[0], b[1], b[2], b[3]);
    },
    
    getArtboardBounds: function(index) {
        var doc = app.activeDocument;
        var ab = doc.artboards[index].artboardRect;
        return this.rect(ab[0], ab[1], ab[2], ab[3]);
    },
    
    getActiveArtboard: function() {
        var doc = app.activeDocument;
        var index = doc.artboards.getActiveArtboardIndex();
        return this.getArtboardBounds(index);
    },
    
    mm: function(mm) {
        return mm * 2.834645669291339;
    }
};

// ============================================
// === ФУНКЦИИ РИСОВАНИЯ ===
// ============================================

function drawLine(p1, p2, strokeWidth, color, layer) {
    var doc = app.activeDocument;
    
    var x1 = parseFloat(p1.x);
    var y1 = parseFloat(p1.y);
    var x2 = parseFloat(p2.x);
    var y2 = parseFloat(p2.y);
    var sw = parseFloat(strokeWidth);
    
    if (isNaN(sw) || sw <= 0) sw = 0.01;
    
    var dx = x2 - x1;
    var dy = y2 - y1;
    var length = Math.sqrt(dx*dx + dy*dy);
    
    if (length < 0.001) return;
    
    var angle = Math.atan2(dy, dx);
    
    var cx = (x1 + x2) / 2;
    var cy = (y1 + y2) / 2;
    
    var rect = layer.pathItems.rectangle(
        cy + sw/2,
        cx - length/2,
        length,
        sw
    );
    
    var rotationAngle = angle * 180 / Math.PI;
    rect.rotate(rotationAngle, true, true, true, true, Transformation.CENTER);
    
    try {
        rect.fillColor = color;
    } catch (e) {
        var black = new CMYKColor();
        black.cyan = 0;
        black.magenta = 0;
        black.yellow = 0;
        black.black = 100;
        rect.fillColor = black;
    }
    rect.filled = true;
    rect.stroked = false;
}

function drawCircle(cx, cy, radius, strokeWidth, color, layer) {
    var doc = app.activeDocument;
    
    var cX = parseFloat(cx);
    var cY = parseFloat(cy);
    var r = parseFloat(radius);
    var sw = parseFloat(strokeWidth);
    
    if (isNaN(sw) || sw <= 0) sw = 0.01;
    if (isNaN(r) || r <= 0) r = 1;
    
    var circle = layer.pathItems.ellipse(cY + r, cX - r, r * 2, r * 2);
    circle.strokeWidth = sw;
    circle.filled = false;
    circle.stroked = true;
    
    try {
        circle.strokeColor = color;
    } catch (e) {
        var black = new CMYKColor();
        black.cyan = 0;
        black.magenta = 0;
        black.yellow = 0;
        black.black = 100;
        circle.strokeColor = black;
    }
}

// ============================================
// === ФУНКЦИИ РИСОВАНИЯ МЕТОК ===
// ============================================

function drawCropMarks(rect, length, offset, width, color, layer) {
    drawLine(
        Coord.point(rect.left - offset, rect.top),
        Coord.point(rect.left - offset - length, rect.top),
        width, color, layer
    );
    drawLine(
        Coord.point(rect.left, rect.top + offset),
        Coord.point(rect.left, rect.top + offset + length),
        width, color, layer
    );
    
    drawLine(
        Coord.point(rect.left - offset, rect.bottom),
        Coord.point(rect.left - offset - length, rect.bottom),
        width, color, layer
    );
    drawLine(
        Coord.point(rect.left, rect.bottom - offset),
        Coord.point(rect.left, rect.bottom - offset - length),
        width, color, layer
    );
    
    drawLine(
        Coord.point(rect.right + offset, rect.top),
        Coord.point(rect.right + offset + length, rect.top),
        width, color, layer
    );
    drawLine(
        Coord.point(rect.right, rect.top + offset),
        Coord.point(rect.right, rect.top + offset + length),
        width, color, layer
    );
    
    drawLine(
        Coord.point(rect.right + offset, rect.bottom),
        Coord.point(rect.right + offset + length, rect.bottom),
        width, color, layer
    );
    drawLine(
        Coord.point(rect.right, rect.bottom - offset),
        Coord.point(rect.right, rect.bottom - offset - length),
        width, color, layer
    );
}

function drawRegistrationMarks(rect, offset, radius, width, color, layer) {
    var cx = rect.cx;
    var cy = rect.cy;
    var ro = offset + radius;
    
    drawCircle(cx, cy + ro, radius, width, color, layer);
    drawLine(
        Coord.point(cx - radius, cy + ro),
        Coord.point(cx + radius, cy + ro),
        width, color, layer
    );
    drawLine(
        Coord.point(cx, cy + ro - radius),
        Coord.point(cx, cy + ro + radius),
        width, color, layer
    );
    
    drawCircle(cx - ro, cy, radius, width, color, layer);
    drawLine(
        Coord.point(cx - ro - radius, cy),
        Coord.point(cx - ro + radius, cy),
        width, color, layer
    );
    drawLine(
        Coord.point(cx - ro, cy - radius),
        Coord.point(cx - ro, cy + radius),
        width, color, layer
    );
    
    drawCircle(cx, cy - ro, radius, width, color, layer);
    drawLine(
        Coord.point(cx - radius, cy - ro),
        Coord.point(cx + radius, cy - ro),
        width, color, layer
    );
    drawLine(
        Coord.point(cx, cy - ro - radius),
        Coord.point(cx, cy - ro + radius),
        width, color, layer
    );
    
    drawCircle(cx + ro, cy, radius, width, color, layer);
    drawLine(
        Coord.point(cx + ro - radius, cy),
        Coord.point(cx + ro + radius, cy),
        width, color, layer
    );
    drawLine(
        Coord.point(cx + ro, cy - radius),
        Coord.point(cx + ro, cy + radius),
        width, color, layer
    );
}

// ============================================
// === ОСНОВНАЯ ЛОГИКА ===
// ============================================

function getColor(colorName) {
    var doc = app.activeDocument;
    try {
        return doc.swatches.getByName(colorName);
    } catch (e) {
        try {
            return doc.swatches.getByName("Black");
        } catch (e2) {
            var black = doc.swatches.add();
            black.name = "Black";
            black.colorType = ColorModel.PROCESS;
            try {
                black.space = ColorSpace.CMYK;
            } catch (e3) {
                try {
                    black.colorSpace = ColorModel.CMYK;
                } catch (e4) {}
            }
            black.colorValue = [0, 0, 0, 100];
            return black;
        }
    }
}

function getColorNames() {
    var names = ["Registration", "Black", "C=100 M=100 Y=100 K=100"];
    var doc = app.activeDocument;
    
    for (var i = 0; i < doc.swatches.length; i++) {
        var swatch = doc.swatches[i];
        if (swatch.name != "Registration" && 
            swatch.name != "Black" &&
            swatch.name != "None" &&
            swatch.name != "White" &&
            swatch.name != "Paper") {
            names.push(swatch.name);
        }
    }
    return names;
}

function drawMarks(area, doCrop, doReg, length, offset, width, radius, color, silent, units) {
    var doc = app.activeDocument;
    var layerName = "myCropMarks";
    
    var layer;
    try {
        layer = doc.layers.getByName(layerName);
        doc.activeLayer = layer;
    } catch (e) {
        layer = doc.layers.add();
        layer.name = layerName;
        doc.activeLayer = layer;
    }
    
    var lengthPt = (units === "pt") ? length : Coord.mm(length);
    var offsetPt = (units === "pt") ? offset : Coord.mm(offset);
    var widthPt = (units === "pt") ? width : Coord.mm(width);
    var radiusPt = (units === "pt") ? radius : Coord.mm(radius);
    
    Coord.init();
    
    try {
        if (area == 0) {
            if (doc.selection.length == 0) {
                showWarning("Нет выделенных объектов.");
                return;
            }
            for (var i = 0; i < doc.selection.length; i++) {
                var rect = Coord.getBounds(doc.selection[i]);
                if (doCrop) drawCropMarks(rect, lengthPt, offsetPt, widthPt, color, layer);
                if (doReg) drawRegistrationMarks(rect, offsetPt, radiusPt, widthPt, color, layer);
            }
        } else if (area == 1) {
            var rect = Coord.getActiveArtboard();
            if (doCrop) drawCropMarks(rect, lengthPt, offsetPt, widthPt, color, layer);
            if (doReg) drawRegistrationMarks(rect, offsetPt, radiusPt, widthPt, color, layer);
        } else if (area == 2) {
            for (var i = 0; i < doc.artboards.length; i++) {
                var rect = Coord.getArtboardBounds(i);
                if (doCrop) drawCropMarks(rect, lengthPt, offsetPt, widthPt, color, layer);
                if (doReg) drawRegistrationMarks(rect, offsetPt, radiusPt, widthPt, color, layer);
            }
        }
    } finally {
        Coord.restore();
    }
    
    showMessage("Готово! Метки созданы на слое '" + layerName + "'.", silent);
}

// ============================================
// === ДИАЛОГ ===
// ============================================

function showDialog() {
    var saved = Settings.load();
    var defaults = {
        doCrop: true,
        doReg: false,
        length: 3,
        offset: 3,
        width: 0.25,
        radius: 3,
        color: "Black",
        area: 0,
        units: "мм",
        silent: false
    };
    
    if (saved) {
        for (var key in defaults) {
            if (saved[key] !== undefined) {
                defaults[key] = saved[key];
            }
        }
    }
    
    var dialog = new Window("dialog", "Метки реза");
    dialog.orientation = "column";
    dialog.alignChildren = "fill";
    dialog.spacing = 10;
    dialog.margins = 15;
    
    // ===== CROP MARKS =====
    var cropGroup = dialog.add("group");
    cropGroup.orientation = "column";
    cropGroup.alignChildren = "left";
    cropGroup.spacing = 5;
    
    var cropCheckbox = cropGroup.add("checkbox", undefined, "Crop Marks");
    cropCheckbox.value = defaults.doCrop;
    
    var cropOptions = cropGroup.add("group");
    cropOptions.orientation = "row";
    cropOptions.spacing = 10;
    cropOptions.alignChildren = "left";
    
    cropOptions.add("statictext", undefined, "Длина:");
    var cropLength = cropOptions.add("edittext", undefined, String(defaults.length));
    cropLength.characters = 6;
    cropOptions.add("statictext", undefined, String(defaults.units));
    
    cropOptions.add("statictext", undefined, "Смещение:");
    var cropOffset = cropOptions.add("edittext", undefined, String(defaults.offset));
    cropOffset.characters = 8;
    cropOffset.onChange = function() {
        this.text = this.text.replace(/[^0-9\-\.\,]/g, '');
    };
    cropOptions.add("statictext", undefined, String(defaults.units) + " (отрицательное = внутрь)");
    
    cropOptions.add("statictext", undefined, "Толщина:");
    var cropWidth = cropOptions.add("edittext", undefined, String(defaults.width));
    cropWidth.characters = 6;
    cropOptions.add("statictext", undefined, String(defaults.units));
    
    // ===== REGISTRATION MARKS =====
    var regGroup = dialog.add("group");
    regGroup.orientation = "column";
    regGroup.alignChildren = "left";
    regGroup.spacing = 5;
    
    var regCheckbox = regGroup.add("checkbox", undefined, "Registration Marks");
    regCheckbox.value = defaults.doReg;
    
    var regOptions = regGroup.add("group");
    regOptions.orientation = "row";
    regOptions.spacing = 10;
    regOptions.alignChildren = "left";
    
    regOptions.add("statictext", undefined, "Радиус:");
    var regRadius = regOptions.add("edittext", undefined, String(defaults.radius));
    regRadius.characters = 6;
    regOptions.add("statictext", undefined, String(defaults.units));
    
    // ===== ЦВЕТ =====
    var colorGroup = dialog.add("group");
    colorGroup.orientation = "row";
    colorGroup.spacing = 10;
    colorGroup.alignChildren = "left";
    
    colorGroup.add("statictext", undefined, "Цвет меток:");
    var colorDropdown = colorGroup.add("dropdownlist", undefined, getColorNames());
    colorDropdown.selection = 0;
    for (var i = 0; i < colorDropdown.items.length; i++) {
        if (colorDropdown.items[i].text == defaults.color) {
            colorDropdown.selection = i;
            break;
        }
    }
    
    // ===== ОБЛАСТЬ =====
    var areaGroup = dialog.add("group");
    areaGroup.orientation = "column";
    areaGroup.alignChildren = "left";
    areaGroup.spacing = 5;
    
    areaGroup.add("statictext", undefined, "Область для меток:");
    var areaButtons = areaGroup.add("group");
    areaButtons.orientation = "row";
    areaButtons.spacing = 15;
    
    var areaSelection = areaButtons.add("radiobutton", undefined, "Выделенные объекты");
    areaSelection.value = (defaults.area == 0);
    var areaArtboard = areaButtons.add("radiobutton", undefined, "Активный артборд");
    areaArtboard.value = (defaults.area == 1);
    var areaAllArtboards = areaButtons.add("radiobutton", undefined, "Все артборды");
    areaAllArtboards.value = (defaults.area == 2);
    
    // ===== ЕДИНИЦЫ ИЗМЕРЕНИЯ =====
    var unitsGroup = dialog.add("group");
    unitsGroup.orientation = "row";
    unitsGroup.spacing = 10;
    unitsGroup.alignChildren = "left";
    
    unitsGroup.add("statictext", undefined, "Единицы измерения:");
    var unitsDropdown = unitsGroup.add("dropdownlist", undefined, ["мм", "pt"]);
    unitsDropdown.selection = (defaults.units === "pt") ? 1 : 0;
    
    unitsDropdown.onChange = function() {
        var unitLabel = unitsDropdown.selection.text;
        var allStaticTexts = dialog.findElements("statictext");
        for (var i = 0; i < allStaticTexts.length; i++) {
            var text = allStaticTexts[i];
            if (text.text === "мм" || text.text === "pt") {
                text.text = unitLabel;
            }
            if (text.text.indexOf("мм (отрицательное") > -1 || text.text.indexOf("pt (отрицательное") > -1) {
                text.text = unitLabel + " (отрицательное = внутрь)";
            }
        }
    };
    
    // ===== ТИХИЙ РЕЖИМ =====
    var silentCheckbox = dialog.add("checkbox", undefined, "Тихий режим (без уведомлений)");
    silentCheckbox.value = defaults.silent || false;
    
    // ===== КНОПКИ =====
    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = "center";
    buttonGroup.spacing = 10;
    
    var okButton = buttonGroup.add("button", undefined, "OK");
    okButton.preferredSize.width = 80;
    okButton.onClick = function() {
        dialog.close(1);
    };
    
    var cancelButton = buttonGroup.add("button", undefined, "Отмена");
    cancelButton.preferredSize.width = 80;
    cancelButton.onClick = function() {
        dialog.close(0);
    };
    
    var result = dialog.show();
    
    if (result == 1) {
        var doCrop = cropCheckbox.value;
        var doReg = regCheckbox.value;
        var length = parseFloat(cropLength.text.replace(",", "."));
        if (isNaN(length)) length = 3;
        
        var offset = parseFloat(cropOffset.text.replace(",", "."));
        if (isNaN(offset)) offset = 3;
        
        var width = parseFloat(cropWidth.text.replace(",", "."));
        if (isNaN(width)) width = 0.25;
        
        var radius = parseFloat(regRadius.text.replace(",", "."));
        if (isNaN(radius)) radius = 3;
        
        var colorName = colorDropdown.selection ? colorDropdown.selection.text : "Black";
        var color = getColor(colorName);
        
        var area = 0;
        if (areaSelection.value) area = 0;
        else if (areaArtboard.value) area = 1;
        else if (areaAllArtboards.value) area = 2;
        
        var units = unitsDropdown.selection.text;
        var silent = silentCheckbox.value;
        
        if (!doCrop && !doReg) {
            showWarning("Не выбраны типы меток.");
            return;
        }
        
        var savedSettings = {
            doCrop: doCrop,
            doReg: doReg,
            length: length,
            offset: offset,
            width: width,
            radius: radius,
            color: colorName,
            area: area,
            units: units,
            silent: silent
        };
        Settings.save(savedSettings);
        
        drawMarks(area, doCrop, doReg, length, offset, width, radius, color, silent, units);
    }
}

// ============================================
// === ТОЧКА ВХОДА ===
// ============================================

function main() {
    if (app.documents.length == 0) {
        showWarning("Откройте документ и попробуйте снова.");
        return;
    }
    
    showDialog();
}

main();