# ECOS - Observatorio de la Guayana Venezolana 🍃

> **Nota:** Este es un proyecto académico desarrollado para la **UCAB**.

ECOS es una aplicación (móvil y web) construida para explorar y registrar la biodiversidad de nuestra región. Más allá de ser solo una herramienta de documentación técnica, el objetivo principal del proyecto es **conectar a las personas con la naturaleza a través del conocimiento**. La lógica es simple: si la gente entiende lo que está viendo, es mucho más probable que lo valore y lo cuide. 


## ⚠️ Stack y Estado de la Infraestructura

Actualmente el proyecto está en fase de desarrollo y corre sobre capas gratuitas (*Free Tier*). Ten esto en cuenta al momento de probar o evaluar la app:

* **Backend / Base de Datos:** Usamos **Supabase** (PostgreSQL, Auth y Storage) en su plan gratuito.
* **APIs de IA:** El escáner de especies se alimenta de servicios de terceros con límites de peticiones mensuales.
* **Disponibilidad:** Es posible que experimentes *timeouts* o errores 500 si la base de datos entra en pausa por inactividad o si quemamos la cuota de la API de identificación.


## ⚙️ Módulos Principales

* **Mapa / Descubrir:** Renderizado de puntos de avistamiento basados en coordenadas GPS, integrado con datos del clima.
* **Escáner (IA):** Captura de imágenes para clasificación de especies. Si el usuario está *offline* en campo, la data se guarda en caché local y se sincroniza después.
* **Comunidad / Observatorio:** Un feed para el catálogo de especies registradas y acceso a streams de video de la zona.


### Desarrolladores

- Diego Caballero.
- Sodyl Abreu.
- Bárbara Garcia.
- Nathaly Rodriguez.
- Dubraska Rodriguez.
