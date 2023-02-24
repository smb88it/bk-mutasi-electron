window.$ = window.jQuery = require("jquery");
const { ipcRenderer } = require('electron');
const version = ipcRenderer.sendSync("version");
const config = require("../config.json");

const CircleProgress = require("js-circle-progress");

let dataSitus = [];
let dataMac = [];

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
      toast.addEventListener('mouseenter', Swal.stopTimer)
      toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
})

var sessionAccount = ipcRenderer.sendSync("session:get");
if (sessionAccount.email) $('.nav-profile .name').text(sessionAccount.email);
if (sessionAccount.situs) $('.nav-profile .situs').text(sessionAccount.situs);
$(".logo .text").text($(".logo .text").text()+" v"+version);

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
            ipcRenderer.send("win:listRekening");
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

$('.loading .text').text("Sedang mengambil data situs...");
$.ajax({
    type: "get",
    url: config.bk_url1+"account/account/sites",
    dataType: "json",
    success: (res) => {
        $('.loading').removeClass('show');
        $('.loading .text').text("Loading...");
        if (res.status) {
            dataSitus = res.data.filter(e => e.site_is_active.toLocaleLowerCase() == "y" );
            if (dataSitus.length > 0 && dataMac.length > 0) $(".loading").removeClass("show");
            setSitus();
        }else{
            Swal.fire({
                title: 'Opsss...!',
                text: "Something went wrong! get situs",
                icon: 'error',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Oke bosss',
            }).then((result) => {
                ipcRenderer.send("close");
            })
        }
    },
    error: (err) => {
        $('.loading').removeClass('show');
        $('.loading .text').text("Loading...");
        Swal.fire({
            title: 'Opsss...!',
            text: "Something went wrong! get situs",
            icon: 'error',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oke bosss',
        }).then((result) => {
            ipcRenderer.send("close");
        })
    }
});

$.ajax({
    type: "GET",
    url: config.url_do+"/macaddres",
    dataType: "json",
    headers: {
        'X-Augipt-Gtwmutasi' : config.key_header_do,
        'X-Augipt-Trustmail': config.key_header_email
    },
    success: function (response) {
        dataMac = response.data;
        if (dataSitus.length > 0 && dataMac.length > 0) $(".loading").removeClass("show");
        setTable(dataMac);
    },
    error: (err) => {
        var msg = err.statusText;
        if ([401, 402].includes(err.status)) msg = err.responseJSON.message.join(",");
        
        Swal.fire({
            title: 'Opsss...!',
            text: msg,
            icon: 'error',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oke bosss',
        }).then((result) => {
            ipcRenderer.send("close");
        })
    }
});

$('.nav-group').click(function() {
    var target = $(this).attr('data-target');
    if(!$(this).hasClass('active') && target != undefined) {
        $(this).parent().find('.active').removeClass('active');
        $(this).addClass('active');
        $(target).collapse('show');

        if (target == "#formMac") {
            $("#formGlobal").trigger("reset");
            $('#formGlobal input[name="method"]').val("post");
            $('.btn-title').text("Simpan");
            $(".search-main").hide();
        }else{
            $(".search-main").val("").show();
        }
    }
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
        var newData = dataMac.filter(e => {
            return e.username.toLocaleLowerCase().includes(val) || e.situs.toLocaleLowerCase().includes(val) || e.macaddres.toLocaleLowerCase().includes(val);
        });

        setTable(newData);
    }else{
        $(this).parent().find('.icon').removeClass('clear');
        $(this).parent().find('.icon').text("search");
        setTable(dataMac);
    }
})

$("#formGlobal").submit(async function(e) {
    e.preventDefault();
    $(".loading").addClass('show');
    var form = $(this).serializeArray().reduce((a,b) => {
        a[b.name] = b.value;
        return a;
    }, {})

    var doUrl = config.url_do+"/macaddres";
    if (form.method != "post") doUrl = doUrl+"/"+form.method;
    $.ajax({
        type: form.method != "post" ? "PUT" : "POST",
        url: doUrl,
        data: form,
        dataType: "json",
        headers: {
            'X-Augipt-Gtwmutasi' : config.key_header_do,
            'X-Augipt-Trustmail': config.key_header_email
        },
        success: function (response) {
            if (form.method == "post") {
                dataMac.push(response.data);
                $('.nav-group[data-target="#listRek"]').click();
            }else{
                var i = dataMac.findIndex(e => e.id == form.method);
                dataMac[i].username = form.username;
                dataMac[i].situs = form.situs;
                dataMac[i].macaddres = form.macaddres;
                $(".kembali").click();
            }
            setTable(dataMac);
            Toast.fire({
                icon: 'success',
                title: 'Info',
                text: "Data berhasil di "+(form.method == "post" ? "tambahkan" : "ubah")
            })
        },
        error: (err) => {
            var msg = err.statusText;
            if ([401, 402].includes(err.status)) msg = err.responseJSON.message.join(",");
            
            Toast.fire({
                icon: 'error',
                title: 'Opssss....',
                text: msg
            })
        }
    });
})

$(".kembali").click(() => {
    $("#listRek").collapse('show');
    $('.nav-left .nav-group').removeClass('active');
    $('[data-target="#listRek"]').addClass("active");
    $(".search-main").val("").show();
})

function setTable(data) {
    $(".loading").removeClass("show");
    var tableMac = $("#tableMac");
    if (data.length > 0) {
        tableMac.find("tbody").children().remove();
        data.sort((a,b) => b.id - a.id).forEach((val,i) => {
            var tr = $(`
                <tr class="text-center" id="${val.username}">
                    <td class="align-middle">${i+1}</td>
                    <td class="align-middle">${val.username}</td>
                    <td class="align-middle">${val.situs}</td>
                    <td class="align-middle">${val.macaddres}</td>
                    <td class="align-middle">
                        <div class="d-flex border-start-0 align-items-center justify-content-center">
                            <div class="update-mac text-info me-2 d-flex align-items-center action-table" type="button" data-id="${val.id}">
                                <span class="material-symbols-outlined">edit</span>
                            </div>
                            <div class="delete-mac text-danger d-flex align-items-center action-table" type="button" data-username="${val.username}" data-id="${val.id}">
                                <span class="material-symbols-outlined text-danger">delete</span>
                            </div>
                        </div>
                    </td>
                </tr>
            `);

            tr.find(".update-mac").click(function() {
                var id = $(this).data("id");
                var data = dataMac.find(e => e.id == id);
                $('input[name="method"]').val(id);
                $('.btn-title').text("Update");

                $('input[name="username"]').val(data.username);
                $('input[name="situs"]').val(data.situs).trigger("change");
                $('input[name="macaddres"]').val(data.macaddres);
                
                $("#formMac").collapse('show');
                $(".search-main").hide();
            })

            tr.find(".delete-mac").click(function() {
                var username = $(this).data("username");
                var id = $(this).data("id");
                Swal.fire({
                    title: 'Apakah anda yakin?',
                    text: "Mau menghapus data mac address "+ username,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Iya, Delete aja.',
                    cancelButtonText: 'Ehhh, Gak jadi deh..',
                }).then((result) => {
                    if (result.isConfirmed) {
                        $(".loading").addClass("show");
                        $.ajax({
                            type: "DELETE",
                            url: config.url_do+"/macaddres/"+id,
                            dataType: "json",
                            headers: {
                                'X-Augipt-Gtwmutasi' : config.key_header_do,
                                'X-Augipt-Trustmail': config.key_header_email
                            },
                            success: function (res) {
                                if (res.status) {
                                    dataMac = dataMac.filter(e => e.id != id);
                                    setTable(dataMac);
                                    Toast.fire({
                                        icon: 'success',
                                        title: 'Info',
                                        text: "Data "+username+" berhasil di delete"
                                    })
                                }else{
                                    Toast.fire({
                                        icon: 'error',
                                        title: 'Opssss....',
                                        text: res.message.join(",")
                                    }) 
                                }
                            },
                            error: (err) => {
                                var msg = err.statusText;
                                if ([401, 402].includes(err.status)) msg = err.responseJSON.message.join(",");
                                
                                Toast.fire({
                                    icon: 'error',
                                    title: 'Opssss....',
                                    text: msg
                                })
                            }
                        });
                    }
                })
                
            })

            tableMac.find("tbody").append(tr);
        });
    }else{
        tableMac.find("tbody").children().remove();
        var tr = $(`
            <tr>
                <td colspan="5" class="text-center">Belum ada data mac address / data mac address tidak di temukan</td>
            </tr>
        `)
        tableMac.find("tbody").append(tr)
    }
}

function setSitus() {
    var target = $("#dropDownSitus");
    if (dataSitus.length > 0) {
        target.find('input[name="situs"]').val(dataSitus[0].site_code);
        target.find('div[data-bs-toggle="dropdown"]').text(dataSitus[0].site_title);
        dataSitus.forEach((e, i) => {
            var html = $(`<li><span class="dropdown-item ${i == 0 ? 'selected' : ''}" data-value="${e.site_code}">${e.site_title}</span></li>`);
            html.click(function() {
                target.find('input[name="situs"]').val(e.site_code).trigger("change");
            })
            target.find('.dropdown-menu').append(html);
        });
    }
    
}

$('input[name="situs"]').change(function() {
    var val = $(this).val();
    var data = dataSitus.find(e => e.site_code == val);
    $(".dropdown-item").removeClass("selected");
    $('.dropdown-item[data-value="'+val+'"]').addClass("selected");
    $('#dropDownSitus div[data-bs-toggle="dropdown"]').text(data.site_title);
})

const ps = new PerfectScrollbar('#content', {
    wheelSpeed: 2,
    wheelPropagation: true,
    minScrollbarLength: 20
});

const psSitus = new PerfectScrollbar('.dropdown-situs', {
    wheelSpeed: 2,
    wheelPropagation: true,
    minScrollbarLength: 20
});

$('.dropdown-search input').keyup(function() {
    var val = $(this).val();
    var list = $(this).closest(".dropdown-situs").find("li").not(".dropdown-search").not('.dropdown-search-notfound');
    if (val != "") {
        var listF = list.filter((i, e) => e.textContent.toLocaleLowerCase().includes(val.toLocaleLowerCase()));
        list.hide();
        if (listF.length > 0) {
            $('.dropdown-search-notfound').hide();
            listF.show();
        }else{
            $('.dropdown-search-notfound').show();
            $('.dropdown-search-notfound').text("Data '"+val+"' tidak ditemukan.");
        }
    }else{
        $('.dropdown-search-notfound').hide();
        list.show();
    }
})

$('#dropDownSitus div[data-bs-toggle="dropdown"]').on("show.bs.dropdown", e => {
    $('.dropdown-search input').focus();
})

$('#dropDownSitus div[data-bs-toggle="dropdown"]').on("show.bs.dropdown", e => {
    $('.dropdown-search input').val("");
    $('.dropdown-menu li').not(".dropdown-search").not('.dropdown-search-notfound').show();
})

$("#dataRekening").click(e => {
    $(".loading").addClass("show");
    ipcRenderer.send("win:listRekening");
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