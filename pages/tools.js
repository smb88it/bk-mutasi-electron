window.$ = window.jQuery = require("jquery");
const { ipcRenderer } = require('electron');
const version = ipcRenderer.sendSync("version");
const config = require("../config.json");
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 5000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

const moment = require("moment-timezone");

const CircleProgress = require("js-circle-progress");

var dataBank = [
    {
        "name": "Bca Mobile",
        "code": "bca-mobile"
    },
    {
        "name": "BRImo",
        "code": "bri"
    },
    {
        "name": "BNI Mobile",
        "code": "bni"
    },
    {
        "name": "Mandiri Livin",
        "code": "livin"
    },
    {
        "name": "DANA",
        "code": "dana"
    },
    {
        "name": "OVO",
        "code": "ovo"
    }
]
var dataSettingDevices = ipcRenderer.sendSync("device:setting:get");
var dataDevice = [];
var deviceSelected = null;
var deviceResolusi = null;
var bankSelected = null;
var menuActive = "tools";
var prosesImage = false;
var hasilConvert = '';

var sessionAccount = ipcRenderer.sendSync("session:get");
if (sessionAccount.email) $('.nav-profile .name').text(sessionAccount.email);
if (sessionAccount.situs) $('.nav-profile .situs').text(sessionAccount.situs);
if (sessionAccount.admin) $("#dataMacAddress").removeClass("d-none");
if (sessionAccount.bank) {
    $(".top-bar .logo .text").text("Tools Bottifire v"+version);
}

ipcRenderer.send("device:get");

ipcRenderer.on("device:get", (e, data) => {
    dataDevice = data;
    func.setDevices();
});

ipcRenderer.on("device:add", (e, data) => {
    Toast.fire({
        icon: 'success',
        title: 'Connect',
        text: 'Device '+data.id+' connected...'
    });

    var dt = dataDevice.map(e => e.id);
    if (!dt.includes(data.id)) dataDevice.push(data);
    func.setDevices();
});

ipcRenderer.on("device:remove", (e, data) => {
    Toast.fire({
        icon: 'info',
        title: 'Disconected',
        text: 'Device '+data.id+' disconected...'
    });

    dataDevice = dataDevice.filter(e => e.id != data.id);
    if ($('#deviceid .listDevices input[name="deviceid"]').val() == data.id) {
        deviceSelected = null;
        deviceResolusi = null;
        $('#deviceid .listDevices .dropdown [data-bs-toggle="dropdown"]').text('Silahkan pilih devices');
        $("#deviceid .listDevices .invalid-feedback").hide();
        $('#deviceid .listDevices input[name="deviceid"]').val("");
        $("#settingDevice").removeClass('d-flex').addClass('d-none');
        $("#deviceid .listDevices input").val("");
        $("#textResoluasi").text(`Resolusi Layar: 0x0`);
    }

    if ($('#collapseTools .listDevices input[name="deviceid2"]').val() == data.id) {
        deviceSelected = null;
        deviceResolusi = null;
        $('#collapseTools .listDevices .dropdown [data-bs-toggle="dropdown"]').text('Silahkan pilih devices');
        $("#collapseTools .listDevices .invalid-feedback").hide();
        $('#collapseTools .listDevices input[name="deviceid2"]').val("");
    }
    func.setDevices();
});

ipcRenderer.on("device:resolusi", (e, data) => {
    if (menuActive != "tools") {
        $("#textResoluasi").text(`Resolusi Layar: ${data.w}x${data.h}`);
        $('input[name="slide_startX"]').attr("max", data.w);
        $('input[name="slide_startY"]').attr("max", data.h);
        $('input[name="slide_endX"]').attr("max", data.w);
        $('input[name="slide_endY"]').attr("max", data.h);
    
        $('input[name="coordinate_X"]').attr("max", data.w);
        $('input[name="coordinate_Y"]').attr("max", data.h);
        
    }
    deviceResolusi = data;
    func.deviceSetting();
})

ipcRenderer.on("device:crop", (e, res) => {
    if (res.status) {
        $("#imgCropBefore").attr("src", res.data.before);
        $("#imgCropAfter").attr("src", res.data.after);
        $("#modalCrop .modal-body").removeClass('loading-modal');
    } else {
        $("#modalCrop").modal("hide");
        Toast.fire({
            icon: 'error',
            title: 'Error',
            text: res.message
        });
    }
})

$('.update').click(function() {
    $('.loading-update').addClass("show");
    ipcRenderer.send("update:check");
})

$('.close').click(() => {
    Swal.fire({
        title: 'Apakah anda yakin?',
        text: "Ingin keluar dari aplikasi.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Iya, Yakin.',
        cancelButtonText: 'Ehhh, Gak jadi deh..'
    }).then((result) => {
        if (result.isConfirmed) {
            $('.loading').addClass('show');
            ipcRenderer.send("close");
        }
    })
});

$('.minimize').click(() => ipcRenderer.send("minimize"));

$(".fullscreen").click(function() {
    if($(this).hasClass('show')) {
        $(this).removeClass('show');
        $(this).text("fullscreen");
    }else{
        $(this).addClass('show');
        $(this).text("fullscreen_exit");
    }
    ipcRenderer.send("fullscreen")
})

$("#btn-logout").click(function() {
    Swal.fire({
        title: 'Apakah anda yakin?',
        text: "Ingin keluar dari account ini.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Iya, Yakin.',
        cancelButtonText: 'Ehhh, Gak jadi deh..'
    }).then((result) => {
        if (result.isConfirmed) {
            $('.loading').addClass('show');
            $('.loading .text').text("Sedang mencoba logout...");
            delete sessionAccount.token;
            ipcRenderer.send("session:put", sessionAccount);
            setTimeout(() => ipcRenderer.send("win:auth") , 2000);
        }
    })
})

const ps = new PerfectScrollbar('#content', {
    wheelSpeed: 2,
    wheelPropagation: true,
    minScrollbarLength: 20
});

const ps2 = new PerfectScrollbar('#textConvert', {
    wheelSpeed: 2,
    wheelPropagation: true,
    minScrollbarLength: 20
});

const circleProgress = new CircleProgress('.progress', {
	max: 100,
	value: 0,
	textFormat: 'percent',
});

const circleProgressOcr = new CircleProgress('.loading-ocr .progress', {
	max: 100,
	value: 10,
	textFormat: 'percent',
});

ipcRenderer.on("autoUpdater:message", (e, res) => {
    const {message, update, install, close, prog} = res;
    $('.loading-update .text').text(message);
    if (close) {
        $('.loading-update .text').text("Loading...");
        $('.loading-update').removeClass("show");
        Swal.fire(
            'Info...!',
            message,
            'info'
        )
    }

    if (prog > 0) circleProgress.value = prog;

    if (update) {
        $('.loading-update .text').text("Loading...");
        $('.loading-update').removeClass("show");
        Swal.fire({
            title: 'Info?',
            text: message,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Iya, Update aja.',
            cancelButtonText: 'Ehhh, Gak jadi deh..'
        }).then((result) => {
            if (result.isConfirmed) {
                $('.loading-update').addClass("show downloaded");
                ipcRenderer.send("update:download");
            }
        })
    }

    if (install) {
        $('.loading-update .text').text("Loading...");
        $('.loading-update').removeClass("show");
        Swal.fire({
            title: 'Info?',
            text: message,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Iya, Install aja.',
            cancelButtonText: 'Ehhh, Gak jadi deh..'
        }).then((result) => {
            if (result.isConfirmed) {
                $('.loading-update').addClass("show");
                ipcRenderer.send("update:install");
            }
        })
    }
    
})

ipcRenderer.on("message:info", (e, msg) => {
    Toast.fire({
        icon: 'info',
        title: 'Info',
        text: msg
    })
})

ipcRenderer.on("message:error", (e, msg) => {
    Toast.fire({
        icon: 'error',
        title: 'Error',
        text: msg
    })
})

const func = {
    init: () => {
        func.setBank();
    },
    setDevices: () => {
        var target = $("#deviceid .listDevices .dropdown-menu");
        var target2 = $("#collapseTools .listDevices .dropdown-menu");
        target.children().remove();
        target2.children().remove();
        var item = $(`
            <li>
                <span class="dropdown-item disabled text-muted" data-value="">Tidak ada device yang tersedia</span>
            </li>`
        );
        var item2 = $(`
            <li>
                <span class="dropdown-item disabled text-muted" data-value="">Tidak ada device yang tersedia</span>
            </li>`
        );
        if(deviceSelected != null && bankSelected != null) {
            $('#deviceid .dropdown [data-bs-toggle="dropdown"]').text(deviceSelected);
            $("#settingDevice").removeClass('d-none').addClass('d-flex');
            
        }
        if (dataDevice.length > 0) {
            dataDevice.forEach((val, i) => {
                item = $(`
                    <li>
                        <span class="dropdown-item" data-value="${val.id}">
                            ${val.id}
                        </span>
                    </li>`
                );
                item2 = $(`
                    <li>
                        <span class="dropdown-item" data-value="${val.id}">
                            ${val.id}
                        </span>
                    </li>`
                );
                item.find('.dropdown-item').not('.disabled').click(function() {
                    $(this).closest('.dropdown-menu').find('.selected').removeClass('selected');
                    $(this).addClass('selected');
                    $(this).closest('.dropdown').find('[data-bs-toggle="dropdown"]').text(val.id);
                    $(this).closest('.form-group').find('input').val(val.id);
                    $(this).closest('.form-group').find(".invalid-feedback").hide();
                    ipcRenderer.send("device:resolusi", val.id);
                });
                item2.find('.dropdown-item').not('.disabled').click(function() {
                    $(this).closest('.dropdown-menu').find('.selected').removeClass('selected');
                    $(this).addClass('selected');
                    $(this).closest('.dropdown').find('[data-bs-toggle="dropdown"]').text(val.id);
                    $(this).closest('.form-group').find('input').val(val.id);
                    $(this).closest('.form-group').find(".invalid-feedback").hide();
                    ipcRenderer.send("device:resolusi", val.id);
                });
                target.append(item);
                target2.append(item2);
            });
        }else{
            target.append(item);
            target2.append(item2);
        }
    },
    setBank: () => {
        var target = $("#deviceid .listBank .dropdown-menu");
        var target2 = $("#collapseTools .listBank .dropdown-menu");
        target.children().remove();
        target2.children().remove();
        var item = $(`
            <li>
                <span class="dropdown-item disabled text-muted" data-value="">Tidak ada bank yang tersedia</span>
            </li>`
        );
        var item2 = $(`
            <li>
                <span class="dropdown-item disabled text-muted" data-value="">Tidak ada bank yang tersedia</span>
            </li>`
        );
        if (dataBank.length > 0) {
            dataBank.forEach((val, i) => {
                item = $(`
                    <li>
                        <span class="dropdown-item" data-value="${val.code}">
                            ${val.name}
                        </span>
                    </li>`
                );

                item2 = $(`
                    <li>
                        <span class="dropdown-item" data-value="${val.code}">
                            ${val.name}
                        </span>
                    </li>`
                );
                
                item.find('.dropdown-item').not('.disabled').click(function() {
                    $(this).closest('.dropdown-menu').find('.selected').removeClass('selected');
                    $(this).addClass('selected');
                    $(this).closest('.dropdown').find('[data-bs-toggle="dropdown"]').text(val.name);
                    $(this).closest('.form-group').find('input').val(val.code);
                    $(this).closest('.form-group').find(".invalid-feedback").hide();
                    func.deviceSetting(val.code);
                });
                item2.find('.dropdown-item').not('.disabled').click(function() {
                    $(this).closest('.dropdown-menu').find('.selected').removeClass('selected');
                    $(this).addClass('selected');
                    $(this).closest('.dropdown').find('[data-bs-toggle="dropdown"]').text(val.name);
                    $(this).closest('.form-group').find('input').val(val.code);
                    $(this).closest('.form-group').find(".invalid-feedback").hide();
                    func.deviceSetting(val.code);
                });
                target.append(item);
                target2.append(item2);
            });
            var item2 = $(`
                <li>
                    <span class="dropdown-item" data-value="">Tidak usah di format</span>
                </li>`
            );
            item2.find('.dropdown-item').not('.disabled').click(function() {
                $(this).closest('.dropdown-menu').find('.selected').removeClass('selected');
                $(this).addClass('selected');
                $(this).closest('.dropdown').find('[data-bs-toggle="dropdown"]').text("Tidak usah di format");
                $(this).closest('.form-group').find('input').val("");
                $(this).closest('.form-group').find(".invalid-feedback").hide();
                func.deviceSetting();
            });
            target2.prepend(item2);
        }else{
            target.append(item);
            target2.append(item2);
        }
    },
    deviceSetting: (val = "") => {
        if (menuActive != "tools") {
            var deviceid = $('.listDevices input[name="deviceid"]').val();
            var bank = $('.listBank input[name="bank"]').val();
            if (deviceid != "" && bank != "") {
                const {w,h} = deviceResolusi;
                var dt = dataSettingDevices.find(e => e.deviceResolusi == w+"x"+h && e.bank == bank);
                $("#settingDevice").removeClass('d-none').addClass('d-flex');
                var not = ["deviceResolusi", "deviceid", "bank"];
                if (dt) {
                    Object.keys(dt).forEach(e => {
                        if(!not.includes(e)) $(`input[name="${e}"]`).val(dt[e]);
                    })
                }else{
                    $("#settingDevice input").val("");
                    $(`input[name="delayAfterClick"]`).val("");
                    
                }
                
            }
        }else{
            func.formatText(val);
        }
    },
    ocr: (type) => {
        if (!prosesImage) {
            var device = $('input[name="deviceid2"]').val();
            var format = $('input[name="format"]').val();
            var resolusi = deviceResolusi;
            if (type == "hp") {
                if (device != "" && resolusi != null) {
                    prosesImage = true;
                    hasilConvert = '';
                    $(".ocr-container").addClass("proses").removeClass('selesai');
                    $(".ocr-container .loading-ocr").addClass("show");
                    ipcRenderer.send("device:ocr", {
                        type,
                        format,
                        device,
                        resolusi
                    });
                } else {
                    prosesImage = false;
                    Toast.fire({
                        icon: 'info',
                        title: 'Info',
                        text: "Silahkan pilih devices"
                    })
                }
            }else{
                prosesImage = true;
                hasilConvert = '';
                $(".ocr-container").addClass("proses").removeClass('selesai');
                $(".ocr-container .loading-ocr").addClass("show");
                ipcRenderer.send("device:ocr", {
                    type,
                    format
                });
            }
        }
    },
    formatText: (type) => {
        if (hasilConvert != "" && menuActive == "tools") {
            var textConvert = hasilConvert.replaceAll("\r\n", "<br>");
            if (type == "bri") {
                const regex = /^.*(Rp\d|rp\d)(\r\n|.)*?\d{1,2}:\d{1,2}:\d{1,2}/gm;
                var data = hasilConvert.match(regex);
                if (data) {
                    data = data.map(e => {
                        var newData = e.split("\r\n");
                        var date = moment(newData[newData.length -1], "DD/MM/YYYY | HH:mm:ss").format("HH:mm:ss");
                        var credit = 0, debit = 0, amount = 0;
                        var mAmount = newData[0].match(/(rp|Rp|RP).*,\d{1,2}/gm)
                        if (mAmount) {
                            amount = mAmount[0].match(/\d+/gm).join("").slice(0,-2);
                        }
                        if (newData[0].includes("+")){
                            credit = amount;
                        }else{
                            debit = amount;
                        }
                        var t2 = newData.filter((e,i,a) => i != 0 && i != a.length-1).join(" ");
                        var transaksi = newData[0].match(/^.*(\+|\-)/gm)[0].replaceAll(/(\+|\-)/gm, "")+t2;
                        
                        return `${date} | ${transaksi} | ${credit} | ${debit}`;
                    });
    
                    textConvert = data.join("<br>");
                }
            }

            if (type == "livin") {
                var time = moment().tz("Asia/Bangkok").format("HH:mm:ss");

                const regex = /^.*(Rp|rp)(\r\n|.)*?\d{5}.*/gm;
                var data = hasilConvert.match(regex);
                if (data) {
                    data = data.map(e => {
                        var newData = e.split("\r\n").filter(e => e != "");
                        var amount = newData[0].match(/\d+/gm).join("");
                        var credit = 0, debit = 0;
                        if (newData[0].includes("+")){
                            credit = amount;
                        }else{
                            debit = amount;
                        }
                        var transaksi = newData.filter((e,i,a) => i != 0).join(" ");
                        return `${time} | ${transaksi} | ${credit} | ${debit}`;
                    });
    
                    textConvert = data.join("<br>");
                }
            }

            if (type == "bca-mobile") {
                var time = moment().tz("Asia/Bangkok").format("HH:mm:ss");
                const regex = /^.*(Rp|rp)(\r\n|.)*?(TRSF|trsf).*/gm;
                var data = hasilConvert.match(regex);
                if (data) {
                    data = data.map(e => {
                        var newData = e.split("\r\n").filter(e => e != "");
                        var amount = newData[0].match(/\d+/gm).join("").slice(0,-2);
                        var mCredit = newData[newData.length-1].match(/(cr|CR)/gm);
                        var credit = 0, debit = 0;
                        if (mCredit){
                            credit = amount;
                        }else{
                            debit = amount;
                        }
                        var first = newData[newData.length-1];
                        var transaksi = first+" "+newData.filter((e,i,a) => i != 0 && i != a.length-1).join(" ").replaceAll(/\.\d{1,2}/gm, " ");
                        return `${time} | ${transaksi} | ${credit} | ${debit}`;
                    });
                    textConvert = data.join("<br>");
                }

            }

            if (type == 'dana') {
                const regex = /^.*(hei|Hei|mengirim|mengirimkan|top\sup)(\r\n|.)*?(\d{1,2}:\d{1,2}).*/gm;
                var data = hasilConvert.match(regex);
                if (data) {
                    data = data.map(e => {
                        var newData = e.split("\r\n").filter(e => e != "");
                        var time = newData[newData.length-1];
                        if (time.toLocaleLowerCase().includes('hari ini')) {
                            time = time.match(/\d{1,2}:\d{1,2}/gm);
                            if (time) time = moment(time[0], "HH:mm").format("HH:mm:ss");
                        }else{
                            time = moment(time, "DD MMM, HH:ss").format("YYYY-MM-DD HH:mm:ss");
                        }
                        var transaksi = newData.filter((e,i,a) => i != a.length-1).join(" ");
                        var amount = 0, credit = 0, debit = 0;
                        var mAmount = transaksi.match(/^.*(Rp|rp).*(\.\d{1,3})/gm);
                        if(mAmount) amount = mAmount[0].match(/\d+/gm).join("");
                        var mDebit = transaksi.match(/mengirim|mengirimkan|top\sup/gm);
                        if (mDebit) {
                            debit = amount;
                        }else{
                            credit = amount;
                        }
                        return `${time} | ${transaksi} | ${credit} | ${debit}`;
                    });
                    textConvert = data.join("<br>");
                }

            }

            if (type == "bni") {
                const regex = /^.*(transfer|TRANSFER)(\r\n|.)*?(\d{1,2}:\d{1,2}:\d{1,2}).*/gm;
                var data = hasilConvert.match(regex);
                if (data) {
                    data = data.map(e => {
                        var amount = 0, credit = 0, debit = 0, t1 = "";
                        var newData = e.split("\r\n").filter(e => e != "");
                        var time = moment(newData[newData.length-1], "YYYY-MM-DD HH:mm:ss").format("HH:mm:ss");
                        var mAmount = newData[0].match(/\d.*(,\d{1,2})/gm);
                        if (mAmount) amount = mAmount[0].split(" ")[0].match(/\d+/gm).join("").slice(0,-2);
                        if (newData[0].match(/\sk\s|\sK\s/gm)) {
                            credit = amount;
                        }else{
                            debit = amount;
                        }
                        
                        var mt1 = newData[0].split(/(\sd\s|\sD\s|\sk\s|\sK\s)/gm);
                        if(mt1) t1 = mt1[0];
                        
                        var transaksi = t1+" "+newData.filter((e,i,a) => i != 0 && i != a.length-1).join(" ");
                        
                        return `${time} | ${transaksi} | ${credit} | ${debit}`;
                    });

                    textConvert = data.join("<br>");
                }
            }

            if (type == "ovo") {
                const regex = /^.*(dari|Dari|DARI|ke|Ke|KE)(\r\n|.)*?(\.\d{1,3}).*/gm;
                var data = hasilConvert.match(regex);
                if (data) {
                    data = data.map(e => {
                        var newData = e.split("\r\n");
                        var credit = 0, debit = 0;
                        var last = newData[newData.length-1];
                        var amount = last.match(/\d+/gm).join("");
                        if (last.toLocaleLowerCase().includes('masuk')) {
                            credit = amount;
                        }else{
                            debit = amount;
                        }

                        var transaksi = newData.join(" ");
                        
                        return `${transaksi} | ${credit} | ${debit}`;
                    });

                    textConvert = data.join("<br>");
                }

            }

            $(".ocr-container .ocr-content .ocr-text .textConvert").html(textConvert);
            func.copyClipboard();
            
        }
    },
    copyClipboard: () => {
        var text = $("#textConvert .textConvert").html();
        text = text.split("<br>").map(e => e.split(" | ").join('\t')).join('\n');
        navigator.clipboard.writeText(text);
        Toast.fire({
            icon: 'info',
            title: 'Info',
            text: "Data berhasil di salin."
        })
    }
}

func.init();

ipcRenderer.on("ocr:cancel", () => {
    prosesImage = false;
    $(".ocr-container").removeClass("proses");
    $(".ocr-container .loading-ocr").removeClass("show").removeClass("downloaded");
});

ipcRenderer.on("ocr:progres", (e, data) => {
    if (data.text) $(".ocr-container .loading-ocr .text").text(data.text);
    $(".ocr-container .loading-ocr").addClass("downloaded");
    circleProgressOcr.value = data.prog;
});

ipcRenderer.on("ocr:hasil", (e, res) => {
    const {text, img, data} = res;
    prosesImage = false;
    hasilConvert = text;
    $(".ocr-container").removeClass("proses").addClass('selesai');
    $(".ocr-container .loading-ocr").removeClass("show").removeClass("downloaded");
    $(".ocr-container .ocr-content .ocr-image img").attr("src", img);
    func.formatText(data.format);
})

$("#mutasi").click(() => ipcRenderer.send("win:listRekening"));

$("#formGlobal").submit(async function(e) {
    e.preventDefault();
    // $(".loading").addClass('show');
    var form = $(this).serializeArray().reduce((a,b) => {
        a[b.name] = b.value;
        return a;
    }, {})
    const {deviceid, bank} = form;

    if (deviceid != "" && bank != "") {
        form.deviceResolusi = deviceResolusi.w+"x"+deviceResolusi.h;
        console.log(form);
        console.log(deviceResolusi);
        console.log(dataSettingDevices);
        var dataExisting = dataSettingDevices.find(e => e.deviceResolusi == form.deviceResolusi);
        var msg = "Data berhasil di tambahkan";
        if (dataExisting) {
            var index = dataSettingDevices.indexOf(dataExisting);
            dataSettingDevices[index] = form;
            msg = "Data berhasil di ubah";
        }else{
            dataSettingDevices.push(form);
        }

        ipcRenderer.send("device:setting:put", dataSettingDevices);
        Toast.fire({
            icon: 'success',
            title: 'Info',
            text: msg
        })
    }
})

$("#refreshDevice").click(() => {
    $("#settingDevice").removeClass('d-flex').addClass('d-none');
    $("#settingDevice input").val("");
    ipcRenderer.send("device:get");
});

$("#testingSlide").click(() => {
    var id = $('input[name="deviceid"]').val();
    var slide_startX = $('input[name="slide_startX"]');
    var slide_startY = $('input[name="slide_startY"]');
    var slide_endX = $('input[name="slide_endX"]');
    var slide_endY = $('input[name="slide_endY"]');
    var slide_durasi = $('input[name="slide_durasi"]');
    if (slide_startX.val() == "") slide_startX.val(0);
    if (slide_startY.val() == "") slide_startY.val(0);
    if (slide_endX.val() == "") slide_endX.val(0);
    if (slide_endY.val() == "") slide_endY.val(0);
    if (slide_durasi.val() == "") slide_durasi.val(0);

    ipcRenderer.send("device:slide", {
        id,
        start: {
            x: Number(slide_startX.val()),
            y: Number(slide_startY.val())
        },
        end: {
            x: Number(slide_endX.val()),
            y: Number(slide_endY.val())
        },
        durasi: Number(slide_durasi.val())
    });
});

$("#testingTombolCari").click(() => {
    var id = $('input[name="deviceid"]').val();
    var x = $('input[name="coordinate_X"]');
    var y = $('input[name="coordinate_Y"]');
    if (x.val() == "") x.val(0);
    if (y.val() == "") y.val(0);

    ipcRenderer.send("device:click", {
        id,
        x: Number(x.val()),
        y: Number(y.val())
    });
});

$("#testingCrop").click(() => {
    $("#modalCrop .modal-body").addClass('loading-modal');
    $("#modalCrop").modal("show");
    var crop_top = $('input[name="crop_top"]');
    var crop_bottom = $('input[name="crop_bottom"]');
    if (crop_top.val() == "") crop_top.val(220);
    if (crop_bottom.val() == "") crop_bottom.val(280);
    var id = $('input[name="deviceid"]').val();
    ipcRenderer.send("device:crop", {
        id,
        top: crop_top.val(),
        bottom: crop_bottom.val()
    });
})

$("#modalCrop").on("hidden.bs.modal", () => {
    ipcRenderer.send("session:clearTmp");
})

$("#btnSettingUpload").click(() => $("#settingFileUpload").click());

$("#btnSettingDownload").click(() => ipcRenderer.send("device:setting:download"));

$("#settingFileUpload").change(function (e) {
    var files = e.target.files;
    if (files.length > 0) {
        var file = files[0];
        var path = file.path;
        ipcRenderer.send("device:setting:upload", path);
    }
})

ipcRenderer.on("device:setting:upload", (e, data) => {
    dataSettingDevices = data;
    Toast.fire({
        icon: 'info',
        title: 'Info',
        text: "Data berhasil di upload."
    })
});

$('.nav-group').click(function() {
    var target = $(this).attr('data-target');
    if(!$(this).hasClass('active') && target != undefined) {
        $(this).parent().find('.active').removeClass('active');
        $(this).addClass('active');
        $(target).collapse('show');
        if (target == "#collapseTools") menuActive = "tools";
        if (target == "#collapseDeviceSetting") menuActive = "settings";
    }
})

$("#ocrComputer").click(() => func.ocr("computer"));
$("#ocrHp").click(() => func.ocr("hp"));
$("#textConvert .btnCopy").click(() => func.copyClipboard());
