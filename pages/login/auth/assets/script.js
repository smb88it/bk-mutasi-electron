const config = ipc.config;
const session = ipc.sendSync("session:get");
const version = ipc.sendSync("version");

$(".logo .text").text($(".logo .text").text()+" v"+version);

$("#situs").SumoSelect({
    placeholder: "Silahkan pilih situs",
    search: true,
    searchText: "Cari situs...",
    noMatch: 'Tidak ditemukan untuk "{0}"'
})

$("#situs").on("sumo:opening", function() {
    $(".err-situs").addClass('d-none');
})

$("#bank").SumoSelect({
    placeholder: "Silahkan pilih bank",
    search: true,
    searchText: "Cari bank...",
    noMatch: 'Tidak ditemukan untuk "{0}"'
})

$("#bank").on("sumo:opening", function() {
    $(".err-bank").addClass('d-none');
})

config.data_bank.forEach((item, i) => {
    $('#bank')[0].sumo.add(item.code,item.name, (i+1));
    if (!item.status) $('#bank')[0].sumo.disableItem(i+1);
});

$('.loading .text').text("Sedang mengecek session...");
setTimeout(() => {
    if (session.token) {
        $.ajax({
            type: "get",
            url: `${config.bk_url1}account/account/account`,
            dataType: "json",
            headers: {
                authorization: session.token
            },
            success: function (res) {
                if (res.status) {
                    $('.loading .text').text("Sedang mengecek privilage user...");
                    setTimeout(() => ipc.send("db:privilage", session), 1000);
                }else{
                    session.token = null;
                    ipc.send("session:put", session);
                    $('.loading .text').text("Sedang mengambil data situs...");
                    $.ajax({
                        type: "get",
                        url: config.bk_url1+"account/account/sites",
                        dataType: "json",
                        success: (res) => {
                            $('.loading').removeClass('show');
                            $('.loading .text').text("Loading...");
                            if (res.status) {
                                res.data.filter(e => e.site_is_active.toLocaleLowerCase() == "y" ).forEach(item => {
                                    $('#situs')[0].sumo.add(item.site_code,item.site_title);
                                });
                                if (session.ingat) {
                                    if (session.email) $('input[name="username"]').val(session.email);
                                    if (session.pass) $('input[name="password"]').val(session.pass);
                                    if (session.situs) $('#situs')[0].sumo.selectItem(session.situs);
                                    if (session.bank) $('#bank')[0].sumo.selectItem(session.bank);
                                    if (session.ingat) $("#checkboxIngatSaya").prop("checked", session.ingat);
                                }
                            }else{
                                Swal.fire({
                                    icon: 'error',
                                    title: 'Oops...',
                                    text: 'Something went wrong! get situs',
                                })
                            }
                        },
                        error: (err) => {
                            $('.loading').removeClass('show');
                            $('.loading .text').text("Loading...");
                            Swal.fire({
                                icon: 'error',
                                title: 'Oops...',
                                text: 'Something went wrong! get situs',
                            })
                        }
                    });
                }
            },
            error: (err) => {
                $('.loading').removeClass('show');
                $('.loading .text').text("Loading...");
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Ada error di BK atau Session anda berakhir silahkan login kembali. Jika masalah berlanjut silahkan hubungi Spv SMB',
                })
            }
        });
    }else{
        $('.loading .text').text("Sedang mengambil data situs...");
        $.ajax({
            type: "get",
            url: config.bk_url1+"account/account/sites",
            dataType: "json",
            success: (res) => {
                $('.loading').removeClass('show');
                $('.loading .text').text("Loading...");
                if (res.status) {
                    res.data.filter(e => e.site_is_active.toLocaleLowerCase() == "y" ).forEach(item => {
                        $('#situs')[0].sumo.add(item.site_code,item.site_title);
                    });
                    if (session.ingat) {
                        if (session.email) $('input[name="username"]').val(session.email);
                        if (session.pass) $('input[name="password"]').val(session.pass);
                        if (session.situs) $('#situs')[0].sumo.selectItem(session.situs);
                        if (session.bank) $('#bank')[0].sumo.selectItem(session.bank);
                        if (session.ingat) $("#checkboxIngatSaya").prop("checked", session.ingat);
                        if (session.type) {
                            $('input[name="type"][value="'+session.type+'"]').prop("checked", true);
                            if (session.type == "tools") {
                                $('select[name="bank"]').attr("required", false);
                                $('select[name="bank"]').closest(".form-group").addClass('d-none');
                            }else{
                                $('select[name="bank"]').attr("required", true);
                                $('select[name="bank"]').closest(".form-group").removeClass('d-none');
                            }
                        }
                    }
                }else{
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: 'Something went wrong! get situs',
                    })
                }
            },
            error: (err) => {
                $('.loading').removeClass('show');
                $('.loading .text').text("Loading...");
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: 'Something went wrong! get situs',
                })
            }
        });
    }
}, 1000);

const ps = new PerfectScrollbar('.SumoSelect .optWrapper ul.options', {
    wheelSpeed: 2,
    wheelPropagation: true,
    minScrollbarLength: 20
});

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
            ipc.send("close")
        }
    })
});

$('.minimize').click(() => ipc.send("minimize"));
    
$(".fullscreen").click(function() {
    if($(this).hasClass('show')) {
        $(this).removeClass('show');
        $(this).text("fullscreen");
    }else{
        $(this).addClass('show');
        $(this).text("fullscreen_exit");
    }
    ipc.send("fullscreen");
})

$(".btn-pass").click(function() {
    var stat = $(this).hasClass('show');
    if (stat) {
        $(this).removeClass('show');
        $(this).text("visibility");
        $(this).parent().find('input').attr('type', 'password');
    }else{
        $(this).addClass('show');
        $(this).text("visibility_off");
        $(this).parent().find('input').attr('type', 'text');
    }
})

$('.update').click(function() {
    $('.loading-update').addClass("show");
    ipc.send("update:check");
})

var firebaseConfig = {
    apiKey: "AIzaSyAc2rQEf2fx_FXR7DYLMkHUcTdkz1Ra8tw",
    authDomain: "augipt-social.firebaseapp.com",
    databaseURL: "https://augipt-social.firebaseio.com",
    projectId: "augipt-social",
    storageBucket: "augipt-social.appspot.com",
    messagingSenderId: "1048845974504"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
let provider = new firebase.auth.GoogleAuthProvider();

function loginFirebase() {
    var idsitus = $('#situs').val();
    var bank = $('#bank').val();
    var type = $('input[name="type"]:checked').val();
    if (idsitus == 0) {
        $('.loading').removeClass('show');
        $(".err-situs").removeClass('d-none');
        return false;
    }else{
        if (bank == 0 && type == "mutasi") {
            $('.loading').removeClass('show');
            $(".err-bank").removeClass('d-none');
            return false;
        } else {
            firebase.auth().signInWithPopup(provider).then(res => {
                login({
                    type: "google",
                    situs: idsitus,
                    email: res.user.email,
                    pass: res.user.uid,
                    type,
                    bank
                })
            }).catch(e => {
                var msg = e.message;
                $('.loading').removeClass('show');
                if (!msg.includes('closed by the user')) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: msg,
                    })
                }
            })
        }
    }
    
}

function login(data) {
    $('.loading').addClass('show');
    $.ajax({
        type: "post",
        url: `${config.bk_url}${data.situs}/dashboard/account/api-login/${data.type}`,
        data: {
            user_email: data.email,
            user_password: data.pass
        },
        dataType: "json",
        success: function (res) {
            if (res.status) {
                $('.loading .text').text("Login berhasil...");
                setTimeout(() => {
                    $('.loading .text').text("Sedang mengecek privilage user...");
                    ipc.send("db:privilage", {
                        token: res.data.authorization,
                        email: data.email,
                        pass: data.pass,
                        situs: data.situs,
                        ingat: $("#checkboxIngatSaya").prop("checked"),
                        bank: data.bank,
                        type: data.type
                    })
                }, 1000);
            }else{
                $('.loading').removeClass('show');
                $('.loading .text').text("Loading...");
                var msg = res.errors.map(e => typeof e == "object" ? e.join(",") : e).join(",");
                Swal.fire({
                    icon: 'error',
                    title: 'Oops...',
                    text: msg,
                })
            }
        },
        error: (err) => {
            $('.loading').removeClass('show');
            $('.loading .text').text("Loading...");
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Something went wrong! login '+data.type,
            })
        }
    });
}

function logout() {
    firebase.auth().signOut();
}

document.getElementById('loginGoogle').addEventListener('click', loginFirebase);

$("#formLogin").submit(function(e) {
    e.preventDefault();
    $('.loading').addClass('show');
    login({
        type: "local",
        situs: $('#situs').val(),
        email: $(this).find('input[name="username"]').val(),
        pass: $(this).find('input[name="password"]').val(),
        ingat: $("#checkboxIngatSaya").prop("checked"),
        type: $('input[name="type"]:checked').val(),
        bank: $('#bank').val()
    })
})

ipc.on("db:privilage", (e, response) => {
    const {data, res} = response;
    if (res.status) {
        $('.loading .text').text("Sedang mengecek Macaddres user...");
        data.admin = res.data ? true : false;
        ipc.send("db:macaddres", data);
    } else {
        $('.loading').removeClass('show');
        $('.loading .text').text("Loading...");
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: res.message,
        })
    }
})

ipc.on("db:macaddres", (e, response) => {
    const {data, res, mac} = response;
    if (res.status) {
        if (res.data.find(e => e.macaddres == mac)) {
            ipc.send("session:put", data);
            setTimeout(() => {
                if (data.type == "mutasi") {
                    ipc.send("win:listRekening");
                }else{
                    ipc.send("win:tools");
                }
            } , 2000);
        }else{
            $('.loading').removeClass('show');
            $('.loading .text').text("Loading...");
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: "You are not allowed because your device has not been registered, please contact SMB Spv to add a device ID ("+mac+") for your account."
            })
        }
    }else{
        $('.loading').removeClass('show');
        $('.loading .text').text("Loading...");
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: res.message,
        })
    }
})

const circleProgress = new CircleProgress('.progress', {
	max: 100,
	value: 0,
	textFormat: 'percent',
});

ipc.on("autoUpdater:message", (e, res) => {
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
                ipc.send("update:download");
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
                ipc.send("update:install");
            }
        })
    }
    
})

$('input[name="type"]').change(function() {
    var val = $(this).val();
    console.log(val);
    if (val == "tools") {
        $('select[name="bank"]').attr("required", false);
        $('select[name="bank"]').closest(".form-group").addClass('d-none');
    }else{
        $('select[name="bank"]').attr("required", true);
        $('select[name="bank"]').closest(".form-group").removeClass('d-none');
    }
})

