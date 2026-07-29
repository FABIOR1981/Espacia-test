// login_local.js
// Valida usuario y contraseña contra usuarios.json (local)
import { APP_CONFIG, APP_VERSION } from './config.js';
import { hashPassword } from './utils.js';

// Establecer el título del proyecto basado en config.js
if (APP_CONFIG && APP_CONFIG.nombreProyecto) {
    document.title = APP_CONFIG.nombreProyecto;
}

// Inyectar versión en UI
document.addEventListener('DOMContentLoaded', () => {
    const versionDisplays = document.querySelectorAll('#app-version-display, .app-version-display');
    versionDisplays.forEach(el => {
        el.textContent = APP_VERSION || "v-.-.-";
    });
});

// Función para aplicar el fondo según el tema
function aplicarFondo() {
    const currentTheme = localStorage.getItem('espacia_theme') || 'classic';
    if (currentTheme === 'classic' && APP_CONFIG.estilos && APP_CONFIG.estilos.fondo) {
        document.body.style.background = APP_CONFIG.estilos.fondo;
    } else {
        document.body.style.background = ''; // Deja que el CSS del tema actúe
    }
    document.body.style.minHeight = '100vh';
}

// Aplicar fondo inicial
aplicarFondo();

// Escuchar cambios en el tema desde el selector
document.addEventListener('themeChanged', aplicarFondo);

async function login(isVoluntary = false) {
    const usuarioInput = document.getElementById('usuario').value.trim();
    const contrasena = document.getElementById('contrasena').value;
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = '';

    if (!usuarioInput || !contrasena) {
        if (isVoluntary) {
            errorDiv.textContent = 'Para cambiar tu contraseña, ingresa tu nombre de usuario y contraseña actual arriba.';
        } else {
            errorDiv.textContent = 'Por favor, complete ambos campos.';
        }
        return;
    }

    const bodyLogin = {
        nomUsu: usuarioInput,
        contrasenaHash: await hashPassword(contrasena)
    };

    try {
        const response = await fetch('/.netlify/functions/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyLogin)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            const user = result.user;
            if (user.requiereCambioPass || isVoluntary) {
                // Forzar u ofrecer cambio de contraseña
                // Crear el CSS del modal si no existe
                if (!document.getElementById('modal-styles')) {
                    const style = document.createElement('style');
                    style.id = 'modal-styles';
                    style.innerHTML = `
                        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999; backdrop-filter: blur(3px); }
                        .modal-box { background: var(--white, white); color: var(--text-main, #333); padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); width: 90%; max-width: 400px; text-align: center; }
                        .modal-title { margin-top: 0; color: #2c3e50; font-size: 1.3rem; margin-bottom: 5px; }
                        .modal-text { color: #666; margin-bottom: 20px; font-size: 0.95rem; }
                        .modal-input { width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 1rem; text-align: center; }
                        .modal-btn { background: #27ae60; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; font-size: 1rem; }
                        .modal-btn:hover { background: #219653; }
                        .modal-error { color: #e74c3c; font-size: 0.85rem; margin-top: -10px; margin-bottom: 15px; display: none; }
                    `;
                    document.head.appendChild(style);
                }

                // Incluir FontAwesome en el head si no existe
                if (!document.getElementById('fa-styles')) {
                    const faStyle = document.createElement('link');
                    faStyle.id = 'fa-styles';
                    faStyle.rel = 'stylesheet';
                    faStyle.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
                    document.head.appendChild(faStyle);
                }

                // Crear modal HTML con FontAwesome
                const modalHtml = `
                    <div class="modal-overlay" id="modal-cambio-pass">
                        <div class="modal-box">
                            <h3 class="modal-title">Cambio de Contraseña</h3>
                            <p class="modal-text" id="modal-desc-pass">Por seguridad, crea una contraseña de al menos 6 caracteres.</p>
                            <div style="position: relative; margin-bottom: 10px;">
                                <input type="password" id="nueva-pass-input" class="modal-input" placeholder="Nueva contraseña" autofocus style="margin-bottom: 0; padding-right: 40px;">
                                <button type="button" id="toggle-nueva-pass" tabindex="-1" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 0; margin: 0; cursor: pointer; color: #666; font-size: 1.3rem;">
                                    <i class="fa fa-eye" id="icon-nueva-pass"></i>
                                </button>
                            </div>
                            <div style="position: relative; margin-bottom: 15px;">
                                <input type="password" id="confirmar-pass-input" class="modal-input" placeholder="Confirmar contraseña" style="margin-bottom: 0; padding-right: 40px;">
                                <button type="button" id="toggle-confirmar-pass" tabindex="-1" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 0; margin: 0; cursor: pointer; color: #666; font-size: 1.3rem;">
                                    <i class="fa fa-eye" id="icon-confirmar-pass"></i>
                                </button>
                            </div>
                            <div id="modal-error-msg" class="modal-error">La contraseña no cumple los requisitos</div>
                            <button id="btn-guardar-pass" class="modal-btn">Guardar y Entrar</button>
                            ${isVoluntary ? '<button id="btn-cancelar-pass" class="modal-btn" style="background: transparent; color: #777; margin-top: 10px; font-weight: normal; border: 1px solid #ccc;">Cancelar</button>' : ''}
                        </div>
                    </div>
                `;

                document.body.insertAdjacentHTML('beforeend', modalHtml);

                const modalObj = document.getElementById('modal-cambio-pass');
                const btnGuardarPass = document.getElementById('btn-guardar-pass');
                const btnCancelarPass = document.getElementById('btn-cancelar-pass');
                const inputPass = document.getElementById('nueva-pass-input');
                const confirmPass = document.getElementById('confirmar-pass-input');
                const errorMsg = document.getElementById('modal-error-msg');
                const descText = document.getElementById('modal-desc-pass');
                // Botones FontAwesome
                const btnToggleNuevaPass = document.getElementById('toggle-nueva-pass');
                const iconNuevaPass = document.getElementById('icon-nueva-pass');
                const btnToggleConfirmarPass = document.getElementById('toggle-confirmar-pass');
                const iconConfirmarPass = document.getElementById('icon-confirmar-pass');

                // Función para alternar visibilidad y icono
                btnToggleNuevaPass.addEventListener('click', () => {
                    inputPass.type = inputPass.type === 'password' ? 'text' : 'password';
                    iconNuevaPass.className = inputPass.type === 'password' ? 'fa fa-eye' : 'fa fa-eye-slash';
                });
                btnToggleConfirmarPass.addEventListener('click', () => {
                    confirmPass.type = confirmPass.type === 'password' ? 'text' : 'password';
                    iconConfirmarPass.className = confirmPass.type === 'password' ? 'fa fa-eye' : 'fa fa-eye-slash';
                });

                // Si no es admin ni gestor, le exigimos reglas fuertes
                const isNormalUser = (user.rol !== 'admin' && user.rol !== 'gestor');
                if (isNormalUser) {
                    descText.textContent = "Por seguridad, crea una contraseña de al menos 6 caracteres, incluyendo una mayúscula, un número y un carácter especial.";
                }

                // Permitir enter en el segundo input
                confirmPass.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') procesarCambioPass();
                });

                // Asegurar foco en el input
                setTimeout(() => inputPass.focus(), 100);

                // Función que maneja el guardado desde el Modal
                const procesarCambioPass = async () => {
                    const nuevaPass = inputPass.value;
                    const passConfirmada = confirmPass.value;
                    
                    // Validar longitud
                    if (!nuevaPass || nuevaPass.length < 6) {
                        errorMsg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                        errorMsg.style.display = 'block';
                        return;
                    }

                    // Validar mayúscula, número y especial con regex SOLO si es usuario normal
                    if (isNormalUser) {
                        const tieneMayuscula = /[A-Z]/.test(nuevaPass);
                        const tieneNumero = /[0-9]/.test(nuevaPass);
                        const tieneEspecial = /[^A-Za-z0-9]/.test(nuevaPass);
                        
                        if (!tieneMayuscula || !tieneNumero || !tieneEspecial) {
                            errorMsg.textContent = 'Debe contener al menos una letra mayúscula, un número y un carácter especial.';
                            errorMsg.style.display = 'block';
                            return;
                        }
                    }

                    if (nuevaPass !== passConfirmada) {
                        errorMsg.textContent = 'Las contraseñas no coinciden.';
                        errorMsg.style.display = 'block';
                        return;
                    }

                    errorMsg.style.display = 'none';

                    btnGuardarPass.disabled = true;
                    btnGuardarPass.textContent = 'Guardando...';
                    
                    const nuevaHash = await hashPassword(nuevaPass);
                    user.requiereCambioPass = false;
                    
                    try {
                        const resp = await fetch('/.netlify/functions/change-password', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${result.token}`
                            },
                            body: JSON.stringify({ nuevaContrasenaHash: nuevaHash })
                        });
                        const updateResult = await resp.json();
                        
                        if (!resp.ok || !updateResult.success) {
                            modalObj.remove();
                            errorDiv.textContent = 'No se pudo guardar la contraseña en el servidor.';
                            return;
                        }
                        
                        // Si todo fue bien, cerramos el modal y logueamos
                        modalObj.remove();
                        const { contrasena: _, ...userSinPass } = user;
                        localStorage.setItem('usuarioActual', JSON.stringify(userSinPass));
                        sessionStorage.setItem('usuarioActual', JSON.stringify(userSinPass));
                            localStorage.setItem('consAge_token', result.token);
                            sessionStorage.setItem('consAge_token', result.token);
                        window.location.href = "dashboard.html";

                    } catch (e) {
                        modalObj.remove();
                        errorDiv.textContent = 'Error de conexión al guardar la nueva contraseña.';
                    }
                };

                // Asignar eventos
                btnGuardarPass.addEventListener('click', procesarCambioPass);
                inputPass.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') procesarCambioPass();
                });
                if (btnCancelarPass) {
                    btnCancelarPass.addEventListener('click', () => {
                        modalObj.remove();
                    });
                }
                
                // Detener la ejecución del resto del script aquí porque el modal es asíncrono puro
                return;
            }
            
            // Guardar usuario autenticado en localStorage (asegurándonos de no guardar la contraseña)
            const { contrasena: _, ...userSinPass } = user;
            try {
                localStorage.setItem('usuarioActual', JSON.stringify(userSinPass));
                sessionStorage.setItem('usuarioActual', JSON.stringify(userSinPass)); // Fallback
                if (result.token) {
                    localStorage.setItem('consAge_token', result.token);
                    sessionStorage.setItem('consAge_token', result.token);
                }
                // Pequeño delay para asegurar persistencia antes de redirigir
                setTimeout(() => {
                    window.location.href = 'dashboard.html';
                }, 100);
            } catch (e) {
                errorDiv.textContent = 'Error guardando usuario en localStorage.';
            }
        } else {
            errorDiv.textContent = result.error || 'Usuario o contraseña incorrectos.';
        }
    } catch (e) {
        errorDiv.textContent = 'Error al validar usuario.';
        console.error(e);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) {
        btnLogin.addEventListener('click', () => { login(false); });
    }

    const btnCambioPassVoluntario = document.getElementById('btnCambioPassVoluntario');
    if (btnCambioPassVoluntario) {
        btnCambioPassVoluntario.addEventListener('click', (e) => {
            e.preventDefault();
            login(true);
        });
    }

    // Permitir login con Enter
    const inputs = ['usuario', 'contrasena'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') login(false);
            });
        }
    });
});
