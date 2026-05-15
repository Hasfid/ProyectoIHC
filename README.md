# ECOS - Observatorio de la Guayana Venezolana 🍃

> **Nota:** Este es un proyecto académico desarrollado para estudiantes de la **UCAB Sede Guayana**.

ECOS es una aplicación (móvil y web) construida para explorar y registrar la biodiversidad de nuestra región. Más allá de ser solo una herramienta de documentación técnica, el objetivo principal del proyecto es conectar a las personas con la naturaleza a través del conocimiento. La lógica es simple, si la gente entiende lo que está viendo, es mucho más probable que lo valore y lo cuide. 


## Datos sobre infraestructura
Se utilizaron los siguientes componentes para el desarrollo:

* Base de Datos: Supabase (PostgreSQL, Auth y Storage) en su plan gratuito.
* APIs de IA: API Gemini 2.0 Pro en su plan gratuito, se limita conocimiento empleando un prompt fijo y un data sets predefinidos sobre animales de la región.

Por lo tanto, existe la posibilidad de que vaya lento, haya cierres inesperados o que algunos apartados no se carguen al completo.


## Módulos Principales
* Mapa/Descubrir: Muestra los registros de especies (animales/plantas) que hayan publicado los usuarios.
* Escáner(IA): Captura de imágenes para clasificación de especies. Si el usuario está offline en campo, la data se guarda en caché local y se sincroniza después.
* Observatorio/Comunidad:  Una sección para ver transmisiones en vivo o video pregrabados de habitats de animales dificiles de acceder o de locaciones, junto a ella está el apartado de comunidad donde los usuarios pueden interactuar entre si.
* Registros: Zona para visualizar todos los registros de las especies registradas por los usuarios.
* Perfil: Una sección donde el usuario puede configurar su perfil, enviar mensajes a otros usuarios y observar sus registros y cargar pendientes.


## Desarrolladores
* Diego Caballero.
* Sodyl Abreu.
* Bárbara Garcia.
* Nathaly Rodriguez.
* Dubraska Rodriguez.


Gracias por tomarte el tiempo de leer, ¡¡espero que te guste!!.


## Instalación y dependencias.

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

1. Instalación de dependencias.

   ```bash
   npm install
   ```

2. Iniciar la app.

   ```bash
   npx expo start
   ```

Para la versión movil escaneando el QR a través de la app de Expo Go en un dispositivo móvil y para la web pulsando 'W' en terminal.

## Documentación de dependencias.
- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo
