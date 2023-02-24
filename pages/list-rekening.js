window.$ = window.jQuery = require("jquery");
ajaxProxy.init();
const { ipcRenderer } = require('electron');
const version = ipcRenderer.sendSync("version");
const config = require("../config.json");
const path = require('path');
const GoogleSheet = require("../libraries/googleSheet");
const keyFile = path.join(__dirname, "../libraries/credentials.json");
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
})

const CircleProgress = require("js-circle-progress");

var dataDevice = [];
var robotStandBy = [];
var robotRunning = [];
var robotInterval = {};
var deviceSelected = null;
var deviceResolusi = null;

var sessionAccount = ipcRenderer.sendSync("session:get");
if (sessionAccount.email) $('.nav-profile .name').text(sessionAccount.email);
if (sessionAccount.situs) $('.nav-profile .situs').text(sessionAccount.situs);
if (sessionAccount.admin) $("#dataMacAddress").removeClass("d-none");
if (sessionAccount.bank) {
    var bank = config.data_bank.find(e => e.code == sessionAccount.bank);
    $(".top-bar .logo img").attr("src", `../assets/images/bank/${bank.img}`);
    $(".top-bar .logo .text").text("List Rekening "+bank.name+" v"+version);
}

if (sessionAccount.bank == "brimo") {
    $("#formProxy").addClass('d-none');
    $("#formBrowser").addClass('d-none');
    $("#formDevices").removeClass("d-none");
    ipcRenderer.send("device:get");
}

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
    if ($('#formDevices input[name="deviceid"]').val() == data.id) {
        deviceSelected = null;
        deviceResolusi = null;
        $('#formDevices .dropdown [data-bs-toggle="dropdown"]').text('Silahkan pilih devices');
        $("#formDevices .invalid-feedback").hide();
        $('#formDevices input[name="deviceid"]').val("");
        $("#settingDevice").removeClass('d-flex').addClass('d-none');
        $("#formDevices input").val("");
        $("#formDevices input").attr("required", false);
        $("#textResoluasi").text(`Resolusi Layar: 0x0`);
    }
    func.setDevices();
});

ipcRenderer.on("device:resolusi", (e, data) => {
    $("#settingDevice").removeClass('d-none').addClass('d-flex');
    $("#settingDevice input").attr("required", true);
    $("#textResoluasi").text(`Resolusi Layar: ${data.w}x${data.h}`);
    $('input[name="slide_startX"]').attr("max", data.w);
    $('input[name="slide_startY"]').attr("max", data.h);
    $('input[name="slide_endX"]').attr("max", data.w);
    $('input[name="slide_endY"]').attr("max", data.h);

    $('input[name="coordinate_X"]').attr("max", data.w);
    $('input[name="coordinate_Y"]').attr("max", data.h);
    deviceResolusi = data;
})

ipcRenderer.on("device:crop", (e, res) => {
    console.log(res);
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
    if (robotStandBy.length == 0) {
        $('.loading-update').addClass("show");
        ipcRenderer.send("update:check");
    }else{
        Swal.fire(
            'Opsss...!',
            'Tunggu bos, masih ada robot yang masih running',
            'info'
        )
    }
})

$('.ocrImage').click(function() {
    if (robotStandBy.length == 0) {
        $('.loading').addClass("show");
        ipcRenderer.send("win:tools");
    }else{
        Swal.fire(
            'Opsss...!',
            'Tunggu bos, masih ada robot yang masih running',
            'info'
        )
    }
})

$('.close').click(() => {
    if (robotStandBy.length == 0) {
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
    }else{
        Swal.fire(
            'Opsss...!',
            'Tunggu bos, masih ada robot yang masih running',
            'info'
        )
    }
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
    if (robotStandBy.length == 0) {
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
    }else{
        Swal.fire(
            'Opsss...!',
            'Tunggu bos, masih ada robot yang masih running',
            'info'
        )
    }
})

var tableRekening = $("#tableRekening");
var dataRekening = ipcRenderer.sendSync("rekening:get");

$('.loading .text').text("Sedang mengambil data rekening...");

const func = {
    getRekening: () => {
        var msg = 'Ada error di BK atau Session anda berakhir silahkan login kembali. Jika masalah berlanjut silahkan hubungi Spv SMB';
        var bank = sessionAccount.bank;
        if (bank == "brimo") bank = "bri";
        $.ajax({
            type: "get",
            url: `${config.bk_url}${sessionAccount.situs}/mutasi/api/rekening/listaccount/${bank}`,
            dataType: "json",
            headers: {
                authorization: sessionAccount.token
            },
            success: (res) => {
                $('.loading .text').text("Sedang mengolah data rekening...");
                if (res.status) {
                    var oldData = dataRekening.map(e => e.username);
                    var data = res.data.data.map(e => {
                        var statProxy = false;
                        var proxyIp = "";
                        if (
                            e.account_is_proxified.toLocaleLowerCase() == "y" &&
                            e.proxy_protocol != null &&
                            e.proxy_host != null &&
                            e.proxy_port != null &&
                            e.proxy_username != null &&
                            e.proxy_password != null
                        ) statProxy = true;
                        if (e.proxy_protocol != null) proxyIp = proxyIp+e.proxy_protocol;
                        if (e.proxy_host != null) proxyIp = proxyIp+"://"+e.proxy_host;
                        if (e.proxy_port != null) proxyIp = proxyIp+":"+e.proxy_port;
                        return {
                            username: e.account_username,
                            password: e.account_password,
                            norek: e.rekening_data[0].rekening_number,
                            interval: 15,
                            status: false,
                            showBrowser: false,
                            typeBrowser: 'chromium',
                            situs: sessionAccount.situs,
                            proxyStatus: statProxy,
                            proxyIp: proxyIp,
                            proxyUsername: e.proxy_username,
                            proxyPassword: e.proxy_password,
                            bank: e.bank_code
                        }
                    })

                    data.forEach(item => {
                        if (oldData.includes(item.username)) {
                            var i = dataRekening.findIndex(e => e.username == item.username);
                            dataRekening[i].username = item.username;
                            dataRekening[i].password = item.password;
                            dataRekening[i].norek = item.norek;
                            dataRekening[i].proxyStatus = item.proxyStatus;
                            dataRekening[i].proxyIp = item.proxyIp;
                            dataRekening[i].proxyUsername = item.proxyUsername;
                            dataRekening[i].proxyPassword = item.proxyPassword;
                            dataRekening[i].bank = item.bank;
                        }else{
                            dataRekening.push(item);
                        }
                    });

                    ipcRenderer.send("rekening:put", dataRekening);
                    setTable(dataRekening);
                    $(".loading").removeClass("show");
                    $('.loading .text').text("Loading...");
                }else{
                    if(res.errors.length > 0) msg = res.errors.map(e => typeof e == "object" ? e.join(", ") : e).join(", ");

                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: msg,
                    }).then(e => {
                        if (e.isConfirmed) {
                            $('.loading').addClass('show');
                            $('.loading .text').text("Sedang mencoba logout...");
                            delete sessionAccount.token;
                            ipcRenderer.send("session:put", sessionAccount);
                            setTimeout(() => ipcRenderer.send("win:auth") , 2000);
                        }
                    })
                }
            },
            error: (err) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: msg
                }).then(e => {
                    if (e.isConfirmed) {
                        $('.loading').addClass('show');
                        $('.loading .text').text("Sedang mencoba logout...");
                        delete sessionAccount.token;
                        ipcRenderer.send("session:put", sessionAccount);
                        setTimeout(() => ipcRenderer.send("win:auth") , 2000);
                    }
                })
            }
        });
    },
    setDevices: () => {
        var target = $("#deviceid .dropdown-menu");
        target.children().remove();
        var item = $(`
            <li>
                <span class="dropdown-item disabled text-muted" data-value="">Tidak ada device yang tersedia</span>
            </li>`
        );
        if(deviceSelected != null) {
            $('#deviceid .dropdown [data-bs-toggle="dropdown"]').text(deviceSelected);
            $("#settingDevice").removeClass('d-none').addClass('d-flex');
            var dataRek = dataRekening.find(e => e.deviceid == deviceSelected);
            $('input[name="deviceid"]').val(dataRek.deviceid);
            $('input[name="delayAfterClick"]').val(dataRek.delayAfterClick);
            $('input[name="slide_startX"]').val(dataRek.slide_startX);
            $('input[name="slide_startY"]').val(dataRek.slide_startY);
            $('input[name="slide_endX"]').val(dataRek.slide_endX);
            $('input[name="slide_endY"]').val(dataRek.slide_endY);
            $('input[name="slide_durasi"]').val(dataRek.slide_durasi);
            $('input[name="coordinate_X"]').val(dataRek.coordinate_X);
            $('input[name="coordinate_Y"]').val(dataRek.coordinate_Y);
            $('input[name="crop_top"]').val(dataRek.crop_top);
            $('input[name="crop_bottom"]').val(dataRek.crop_bottom);
            if(dataRek.deviceResolusi) $("#textResoluasi").text(`Resolusi Layar: ${dataRek.deviceResolusi.w}x${dataRek.deviceResolusi.h}`);
            deviceResolusi = dataRek.deviceResolusi;
            
        }
        var deviceNotAllow = dataRekening.map(e => e.deviceid).filter(e => e != undefined || e != '');
        if (dataDevice.length > 0) {
            dataDevice.forEach((val, i) => {
                var selec = false;
                var info = '';
                if (deviceSelected != null && val.id == deviceSelected) selec = true;
                if (deviceSelected == null && deviceNotAllow.includes(val.id)) info = '<small class="text-muted">sudah digunakan</small>';
                item = $(`
                    <li>
                        <span class="dropdown-item ${selec ? 'selected' : ''} ${info != '' ? 'disabled' : ''}" data-value="${val.id}">
                            ${val.id} ${info}
                        </span>
                    </li>`
                );
                item.find('.dropdown-item').not('.disabled').click(function() {
                    $(this).closest('.dropdown-menu').find('.selected').removeClass('selected');
                    $(this).addClass('selected');
                    $(this).closest('.dropdown').find('[data-bs-toggle="dropdown"]').text(val.id);
                    $(this).closest('.form-group').find('input').val(val.id);
                    $("#formDevices .invalid-feedback").hide();
                    $("#settingDevice").removeClass('d-flex').addClass('d-none')
                    ipcRenderer.send("device:resolusi", val.id);
                })
                target.append(item);
            });
            $('input[name="delayAfterClick"]').attr("required", true);
        }else{
            target.append(item);
        }
    }
}

func.getRekening();

$('.nav-group').click(function() {
    var target = $(this).attr('data-target');
    if(!$(this).hasClass('active') && target != undefined && robotStandBy.length == 0) {
        $(this).parent().find('.active').removeClass('active');
        $(this).addClass('active');
        $(target).collapse('show');

        if (target == "#formRekening") {
            $("#formGlobal").trigger("reset");
            $('#formGlobal input[name="method"]').val("post");
            $('.btn-title').text("Simpan");
        }
    }
})

$(".search-main .icon").click(function() {
    var val = $('.search-main input').val();
    var disabled = $('.search-main input').prop("disabled");
    if (!disabled) {
        if($(this).hasClass('clear')) {
            $(this).removeClass('clear');
            $(this).text("search");
            $(this).parent().find('input').val('');
            $(this).parent().find('input').focus();
        }else{
            if(val != "") {
                $(this).addClass('clear');
                $(this).text("close");
            }else{
                $(this).parent().find('input').focus()
            }
        }
        $(this).parent().find('input').trigger('change');
    }
})

$('.search-main input').keyup(function() {
    $(this).trigger('change');
})

$('.search-main input').change(function() {
    var val = $(this).val();
    if (val != "") {
        $(this).parent().find('.icon').addClass('clear');
        $(this).parent().find('.icon').text("close");
        var newData = dataRekening.filter(e => {
            return e.username.toLocaleLowerCase().includes(val) || e.password.toLocaleLowerCase().includes(val) || e.norek.toLocaleLowerCase().includes(val);
        });

        setTable(newData);
    }else{
        $(this).parent().find('.icon').removeClass('clear');
        $(this).parent().find('.icon').text("search");
        setTable(dataRekening);
    }
})

$("#checkboxGoogleSheet").change(function() {
    var prop = $(this).prop("checked");
    $('input[name="spreadsheetId"]').attr('required', prop);
    $('input[name="range"]').attr('required', prop);
})

function setTable(data) {
    if (data.length > 0) {
        tableRekening.find("tbody").children().remove();
        var n = 0;
        data.forEach((val,i) => {
            var device = '-';
            var bank = sessionAccount.bank;
            if (bank == "brimo") {
                device = val.deviceid ? val.deviceid : '-';
                bank = "bri";
            }else{
                device = val.typeBrowser;
            }
            
            if (sessionAccount.situs == val.situs && bank == val.bank) {
                n += 1;
                var tr = $(`
                    <tr class="text-center" id="${val.username}">
                        <td class="align-middle number">${n}</td>
                        <td class="align-middle">${val.username}</td>
                        <td class="align-middle">${val.password}</td>
                        <td class="align-middle">${val.norek}</td>
                        <td class="align-middle interval">${val.interval}s</td>
                        <td class="align-middle devices">${device}</td>
                        <td class="text-center align-middle">
                            <div class="form-check d-flex justify-content-center">
                                <input class="form-check-input changeStatus" type="checkbox" id="checkBoxStatus${i}" ${val.status ? 'checked' : ''} data-username="${val.username}">
                                <label class="form-check-label" for="checkBoxStatus${i}"></label>
                            </div>
                        </td>
                        <td class="text-center align-middle">
                            <div class="form-check d-flex justify-content-center">
                                <input class="form-check-input statusProxy" type="checkbox" id="checkBox${i}" disabled ${val.proxyStatus ? 'checked' : ''}>
                                <label class="form-check-label" for="checkBox${i}"></label>
                            </div>
                        </td>
                        <td class="text-center align-middle">
                            <div class="form-check d-flex justify-content-center">
                                <input class="form-check-input statusGSheet" type="checkbox" id="statusGoogleSheet${i}" disabled ${val.statusGoogleSheet ? 'checked' : ''}>
                                <label class="form-check-label" for="statusGoogleSheet${i}"></label>
                            </div>
                        </td>
                        <td class="align-middle">
                            <div class="d-flex border-start-0 align-items-center justify-content-center">
                                <div class="playStop-mutasi d-flex align-items-center me-2 ${val.status ? '' : 'd-none'}" type="button" data-username="${val.username}">
                                    <span class="material-symbols-outlined text-success">play_circle</span>
                                </div>
                                <div class="update-mutasi text-info me-2 d-flex align-items-center action-table" type="button" data-username="${val.username}">
                                    <span class="material-symbols-outlined">edit</span>
                                </div>
                                <div class="delete-mutasi text-danger d-flex align-items-center action-table" type="button" data-username="${val.username}">
                                    <span class="material-symbols-outlined text-danger">delete</span>
                                </div>
                            </div>
                        </td>
                        <td class="keterangan-table fw-bold align-middle" data-username="${val.username}">
                            <span class="badge text-bg-warning text-wrap">Offline</span>
                        </td>
                    </tr>
                `)
    
                tr.find(".changeStatus").change(function() {
                    $(".loading").addClass("show");
                    var prop = $(this).prop("checked");
                    var username = $(this).data("username");
                    dataRekening = dataRekening.map(e => {
                        if (e.username == username) e.status = prop;
                        return e;
                    });
                    tr.find(`.playStop-mutasi[data-username="${username}"]`).toggleClass("d-none");
                    ipcRenderer.send("put-list-rekening", dataRekening);
                    $(".loading").removeClass("show");
                })
    
                tr.find(".update-mutasi").click(function() {
                    var username = $(this).data("username");
                    var data = dataRekening.find(e => e.username == username);
                    deviceSelected = data.deviceid ? data.deviceid : null;
                    ipcRenderer.send("device:get");
                    
                    $('input[name="method"]').val(username);
                    $('.btn-title').text("Update");
    
                    $('input[name="username"]').val(data.username);
                    $('input[name="password"]').val(data.password);
                    $('input[name="norek"]').val(data.norek);
                    $('input[name="interval"]').val(data.interval);
                    $('input[name="proxyStatus"]').prop("checked", data.proxyStatus);
                    $('input[name="proxyIp"]').val(data.proxyIp);
                    $('input[name="proxyUsername"]').val(data.proxyUsername);
                    $('input[name="proxyPassword"]').val(data.proxyPassword);
                    $('input[name="statusGoogleSheet"]').prop("checked", data.statusGoogleSheet)
                    $('input[name="spreadsheetId"]').val(data.spreadsheetId);
                    $('input[name="range"]').val(data.range);
    
                    $('input[name="showBrowser"]').prop("checked", data.showBrowser ? data.showBrowser : false);
                    var typeBrowser = data.typeBrowser ? data.typeBrowser : "chromium";
                    $('input[name="typeBrowser"]').val(typeBrowser);
                    $('.dropdown-item').removeClass('selected');
                    var targetTypeBrowser = $(`.dropdown-item[data-value="${typeBrowser}"]`);
                    targetTypeBrowser.addClass('selected');
                    var text = targetTypeBrowser.text();
                    var img = targetTypeBrowser.parent().find('.icon').attr("src");
                    targetTypeBrowser.closest('.form-group').find('[data-bs-toggle="dropdown"]').text(text);
                    targetTypeBrowser.closest('.form-group').find('.icon-default').attr('src', img);
                    
                    $("#formRekening").collapse('show');
                    $(".search-main").val("").trigger("change").hide();
                })
    
                tr.find(".delete-mutasi").click(function() {
                    var username = $(this).data("username");
                    var $this = this;
                    Swal.fire({
                        title: 'Apakah anda yakin?',
                        text: "Mau menghapus data rekening "+ username,
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#d33',
                        confirmButtonText: 'Iya, Delete aja.',
                        cancelButtonText: 'Ehhh, Gak jadi deh..'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            dataRekening = dataRekening.filter(e => e.username != username);
                            ipcRenderer.send("rekening:put", dataRekening);
                            Swal.fire(
                                'Deleted!',
                                'Rekening '+ username + ' berhasil di hapus.',
                                'success'
                            );
                            $($this).closest("tr").remove();
                            tableRekening.find("tbody tr").each((i, e) => $(e).find(".number").text(i+1));
                        }
                    })
                    
                })
    
                tr.find(".playStop-mutasi").click(function() {
                    var username = $(this).data("username");
                    var stat = $(this).hasClass('on');
                    var data = dataRekening.find(e => e.username == username);
                    if (!robotRunning.includes(username)) {
                        if (stat) {
                            Swal.fire({
                                title: 'Apakah anda yakin?',
                                text: "Mau menghentikan robot "+ username,
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#3085d6',
                                cancelButtonColor: '#d33',
                                confirmButtonText: 'Iya, Yakin.',
                                cancelButtonText: 'Ehhh, Gak jadi deh..'
                            }).then((result) => {
                                if (result.isConfirmed) {
                                    clearInterval(robotInterval[username]);
                                    delete robotInterval[username];
                                    robot.logoutBank(username);
                                }
                            })
                        }else{
                            robot.start(data);
                        }
                    }
                })
    
                tableRekening.find("tbody").append(tr);
            }
        });
    }else{
        tableRekening.find("tbody").children().remove();
        var tr = $(`
            <tr>
                <td colspan="10" class="text-center">Belum ada data rekening / data rekening tidak di temukan</td>
            </tr>
        `)
        tableRekening.find("tbody").append(tr)
    }
}

$("#formGlobal").submit(async function(e) {
    e.preventDefault();
    $(".loading").addClass('show');
    var form = $(this).serializeArray().reduce((a,b) => {
        a[b.name] = b.value;
        return a;
    }, {})

    if (sessionAccount.bank == "brimo" && form.deviceid == "") {
        $("#deviceid .invalid-feedback").show();
        $(".loading").removeClass("show");
        return false;
    }else{
        $("#deviceid .invalid-feedback").hide();
    }

    form.statusGoogleSheet = form.statusGoogleSheet == undefined ? false : true;
    form.showBrowser = form.showBrowser == undefined ? false : true;

    if (form.statusGoogleSheet) {
        try {
            var googleSheet = new GoogleSheet({
                keyFile: keyFile,
                spreadsheetId: form.spreadsheetId,
                range: form.range,
                keys: ["tanggal","transaksi","debet","kredit","saldo"],
            });
    
            var check = await googleSheet.getAll();
        } catch (error) {
            $(".loading").removeClass('show');
            Toast.fire({
                icon: 'error',
                title: 'Error',
                text: 'Data google sheet yang anda masukkan salah, silahkan coba chek dengan teliti bos...'
            })
            return false;
        }
    }
    
    var method = form.method;
    if (form.method == "post") {
        form.status = false;
        delete form.method;
        dataRekening.push(form);
        setTable(dataRekening);
    }else{
        var index = dataRekening.findIndex(e => e.username == form.method);
        delete form.method;

        dataRekening[index].interval = form.interval;

        dataRekening[index].statusGoogleSheet = form.statusGoogleSheet;
        dataRekening[index].spreadsheetId = form.spreadsheetId;
        dataRekening[index].range = form.range;

        dataRekening[index].showBrowser = form.showBrowser;
        dataRekening[index].typeBrowser = form.typeBrowser;

        if (sessionAccount.bank == "brimo") {
            dataRekening[index].deviceid = form.deviceid;
            dataRekening[index].delayAfterClick = form.delayAfterClick;
            dataRekening[index].slide_startX = form.slide_startX;
            dataRekening[index].slide_startY = form.slide_startY;
            dataRekening[index].slide_endX = form.slide_endX;
            dataRekening[index].slide_endY = form.slide_endY;
            dataRekening[index].slide_durasi = form.slide_durasi;
            dataRekening[index].coordinate_X = form.coordinate_X;
            dataRekening[index].coordinate_Y = form.coordinate_Y;
            dataRekening[index].crop_top = form.crop_top;
            dataRekening[index].crop_bottom = form.crop_bottom;
            dataRekening[index].deviceResolusi = deviceResolusi;
            
            $(`#${dataRekening[index].username}`).find('.devices').text(form.deviceid);
        }else{
            $(`#${dataRekening[index].username}`).find('.devices').text(form.typeBrowser);
        }
        
        $(`#${dataRekening[index].username}`).find('.interval').text(form.interval+"s");
        $(`#${dataRekening[index].username}`).find('.statusGSheet').prop("checked", form.statusGoogleSheet);
        
        $(".loading").removeClass("show");
    }
    ipcRenderer.send("rekening:put", dataRekening);
    $(".kembali").click();
    Toast.fire({
        icon: 'success',
        title: 'Info',
        text: 'Data berhasil di '+(method == "post" ? 'tambahkan.' : 'ubah.')
    })
})

$("#startAndStopRobot").click(function() {
    var stat = $(this).hasClass("on");
    if (stat) {
        if (robotRunning.length == 0) {
            Swal.fire({
                title: 'Apakah anda yakin?',
                text: "Mau menghentikan robot ?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Iya, Yakin.',
                cancelButtonText: 'Ehhh, Gak jadi deh..'
            }).then((result) => {
                if (result.isConfirmed) {
                    robotStandBy.forEach(item => {
                        clearInterval(robotInterval[item]);
                        delete robotInterval[item];
                        robot.logoutBank(item);
                    });
                }
            })
        }else{
            Swal.fire(
                'Opsss...!',
                'Tunggu bos, masih ada robot yang masih running',
                'info'
            )
        }
    }else{
        $('.search-main input').val('').trigger('change');
        $('[data-target="#listRek"]').click();
        var data = dataRekening.filter(e => e.status);
        data.forEach(item => robot.start(item));
    }
})

$(".kembali").click(() => {
    $("#formGlobal").trigger("reset");
    $("#listRek").collapse('show');
    $('.nav-left .nav-group').removeClass('active');
    $('[data-target="#listRek"]').addClass("active");
    $(".search-main").val("").trigger("change").show();
    deviceSelected = null;
    deviceResolusi = null;
    $('#formDevices .dropdown [data-bs-toggle="dropdown"]').text('Silahkan pilih devices');
    $("#formDevices .invalid-feedback").hide();
    $('#formDevices input[name="deviceid"]').val("");
    $("#settingDevice").removeClass('d-flex').addClass('d-none');
    $("#formDevices input").val("");
    $("#formDevices input").attr("required", false);
    $("#textResoluasi").text(`Resolusi Layar: 0x0`);
})

ipcRenderer.on("change-status", (e, data) => {
    var html = `<span class="badge text-bg-${data.error ? 'danger' : 'success'} text-wrap">${data.message}</span>`;
    $(`.keterangan-table[data-username="${data.username}"]`).html(html);
    if (data.error) {
        setTimeout(() => {
            var dt = dataRekening.find(e => e.username == data.username);
            robot.stop(dt, false);
        }, 1000);
    }

    if (data.runInterval) robot.runInterval(data);
})

const robot = {
    start: (data) => {
        if (robotStandBy.length == 0) {
            $('.search-main input').attr("disabled", true);
            $("#startAndStopRobot").attr('class', 'nav-group bg-warning');
            $("#startAndStopRobot").find('.material-symbols-outlined').text("stop_circle");
            $("#startAndStopRobot").find('.nav-item-title').text("Stop Robot");
            $("#startAndStopRobot").addClass('on');
        }

        $(`.changeStatus[data-username="${data.username}"]`).attr("disabled", true);
        $(`.action-table[data-username="${data.username}"]`).addClass('d-none');
        var ps = $(`.playStop-mutasi[data-username="${data.username}"]`);
        ps.addClass("on");
        ps.addClass('spin');
        ps.find('.material-symbols-outlined').removeClass('text-success').removeClass('text-warning').addClass('text-info');
        ps.find('.material-symbols-outlined').text('cached');
        
        $(`.keterangan-table[data-username="${data.username}"]`).html('<span class="badge text-bg-success">Sedang membuat browser.</span>');
        robotStandBy.push(data.username);
        robotRunning.push(data.username);

        ipcRenderer.send("robot:play", data);
    },
    stop: (data, changeKet = true) => {
        robotStandBy = robotStandBy.filter(e => e != data.username);
        robotRunning = robotRunning.filter(e => e != data.username);

        if (robotStandBy.length == 0) {
            $('.search-main input').attr("disabled", false);
            $("#startAndStopRobot").attr('class', 'nav-group bg-success');
            $("#startAndStopRobot").find('.material-symbols-outlined').text("play_circle");
            $("#startAndStopRobot").find('.nav-item-title').text("Start Robot");
            $("#startAndStopRobot").removeClass('on');
        }

        $(`.changeStatus[data-username="${data.username}"]`).attr("disabled", false);
        $(`.action-table[data-username="${data.username}"]`).removeClass('d-none');
        var ps = $(`.playStop-mutasi[data-username="${data.username}"]`);
        ps.removeClass("on");
        ps.removeClass("spin");
        ps.find('.material-symbols-outlined').removeClass('text-warning').removeClass('text-info').addClass('text-success');
        ps.find('.material-symbols-outlined').text('play_circle');
        
        if(changeKet) $(`.keterangan-table[data-username="${data.username}"]`).html('<span class="badge text-bg-warning">Offline</span>');
        
        ipcRenderer.send("robot:stop", data);
    },
    runInterval: (data) => {
        robotRunning = robotRunning.filter(e => e != data.username);
        var bank = dataRekening.find(e => e.username == data.username);
        var ps = $(`.playStop-mutasi[data-username="${data.username}"]`);
        ps.removeClass("spin");
        ps.find('.material-symbols-outlined').removeClass('text-success').removeClass('text-info').addClass('text-warning');
        ps.find('.material-symbols-outlined').text('stop_circle');
        var interval = bank.interval;
        $(`.keterangan-table[data-username="${data.username}"]`).html('<span class="badge text-bg-success">'+interval+'s</span>');
        robotInterval[data.username] = setInterval(() => {
            if (interval == 0) {
                clearInterval(robotInterval[data.username]);
                delete robotInterval[data.username];
                robotRunning.push(data.username);
                ps.addClass("on");
                ps.addClass('spin');
                ps.find('.material-symbols-outlined').removeClass('text-success').removeClass('text-warning').addClass('text-info');
                ps.find('.material-symbols-outlined').text('cached');
                $(`.keterangan-table[data-username="${data.username}"]`).html('<span class="badge text-bg-success">Sedang ambil data saldo</span>');
                ipcRenderer.send("robot:interval", bank);
            }else{
                interval -= 1;
                $(`.keterangan-table[data-username="${data.username}"]`).html('<span class="badge text-bg-success">'+interval+'s</span>');
            }
        }, 1000);
    },
    logoutBank: (username) => {
        robotRunning.push(username);
        var ps = $(`.playStop-mutasi[data-username="${username}"]`);
        ps.addClass("on");
        ps.addClass('spin');
        ps.find('.material-symbols-outlined').removeClass('text-success').removeClass('text-warning').addClass('text-info');
        ps.find('.material-symbols-outlined').text('cached');
        ipcRenderer.send("robot:logout", username);
    }
}

$("#reloadList").click(() => {
    if (robotStandBy.length == 0) {
        $(".loading").addClass("show");
        func.getRekening();
    }else{
        Swal.fire(
            'Opsss...!',
            'Tunggu bos, masih ada robot yang masih running',
            'info'
        )
    }
});

$("#resetList").click(() => {
    if (robotStandBy.length == 0) {
        Swal.fire({
            title: 'Apakah anda yakin?',
            text: "Semua config pada rekening akan kembali ke pengaturan awal.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Iya, Yakin.',
            cancelButtonText: 'Ehhh, Gak jadi deh..'
        }).then((result) => {
            if (result.isConfirmed) {
                $(".loading").addClass("show");
                dataRekening = [];
                func.getRekening();
            }
        })
    }else{
        Swal.fire(
            'Opsss...!',
            'Tunggu bos, masih ada robot yang masih running',
            'info'
        )
    }
});

$("#formBrowser .dropdown .dropdown-menu .dropdown-item").click(function() {
    var value = $(this).data("value");
    var img = $(this).parent().find('img').attr('src');
    $(this).closest('.dropdown-menu').find('.selected').removeClass('selected');
    $(this).addClass('selected');
    $(this).closest('.dropdown').find('[data-bs-toggle="dropdown"]').text($(this).text());
    $(this).closest('.form-group').find('input').val(value);
    $(this).closest('.form-group').find('.icon-default').attr('src', img);
    
})

const ps = new PerfectScrollbar('#content', {
    wheelSpeed: 2,
    wheelPropagation: true,
    minScrollbarLength: 20
});

$("#dataMacAddress").click(e => {
    if (robotStandBy.length == 0) {
        $('.loading').addClass("show");
        ipcRenderer.send("win:macAddress");
    }else{
        Swal.fire(
            'Opsss...!',
            'Tunggu bos, masih ada robot yang masih running',
            'info'
        )
    }
})

const circleProgress = new CircleProgress('.progress', {
	max: 100,
	value: 0,
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