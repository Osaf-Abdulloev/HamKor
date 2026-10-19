"""
Multilingual localizations for HamKor Telegram Bot messages (TJ, RU, EN).
"""

MESSAGES = {
    "ru": {
        "welcome": (
            "Привет! 👋\n\n"
            "Telegram успешно подключён к вашему аккаунту HamKor.\n\n"
            "Теперь мы сможем отправлять вам важные персональные уведомления:\n"
            "• Новые отклики на ваши вакансии и статусы заявок;\n"
            "• Изменения по вакансиям и релевантные подборки;\n"
            "• Прямые сообщения от работодателей и кандидатов;\n"
            "• Системные уведомления платформы HamKor.\n\n"
            "Ваш Telegram успешно связан с аккаунтом."
        ),
        "link_success": "🎉 Ваш аккаунт <b>{full_name}</b> успешно привязан к HamKor!",
        "already_linked": "ℹ️ Этот аккаунт Telegram уже привязан к вашей учетной записи HamKor.",
        "already_linked_other": "⚠️ Этот Telegram аккаунт уже привязан к другому пользователю HamKor.",
        "invalid_token": "❌ Недействительный или уже использованный токен привязки.",
        "expired_token": "⏳ Срок действия токена привязки истек. Сгенерируйте новый код в профиле на сайте HamKor.tj.",
        "not_linked_instructions": (
            "👋 Здравствуйте! Это официальный бот платформы поиска работы <b>HamKor.tj</b>.\n\n"
            "Для подключения уведомлений:\n"
            "1. Зайдите в ваш профиль на сайте <a href='http://171.22.174.199:2212'>HamKor.tj</a>.\n"
            "2. Перейдите в раздел Telegram и нажмите <b>«Подключить Telegram»</b>.\n"
            "3. Перейдите по перенаправленной ссылке в этого бота."
        ),
        "help": (
            "🤖 <b>Команды бота HamKor:</b>\n\n"
            "• /start — Запустить бота / Проверить привязку\n"
            "• /profile — Показать информацию о вашем профиле\n"
            "• /jobs — Персональные рекомендации вакансий\n"
            "• /notifications — Последние уведомления\n"
            "• /settings — Настройки уведомлений\n"
            "• /unsubscribe — Отключить Telegram уведомления\n"
            "• /help — Справка по командам"
        ),
        "profile_info": (
            "👤 <b>Ваш профиль HamKor:</b>\n\n"
            "<b>Имя:</b> {full_name}\n"
            "<b>Логин:</b> @{username}\n"
            "<b>Email:</b> {email}\n"
            "<b>Роль:</b> {role_str}\n"
            "<b>Город:</b> {city}\n"
            "<b>Должность/Организация:</b> {position_or_company}\n"
            "<b>Уведомления Telegram:</b> {notifications_status}"
        ),
        "settings_info": (
            "⚙️ <b>Настройки уведомлений Telegram:</b>\n\n"
            "• Уведомления: <b>{status}</b>\n"
            "• Рекомендации вакансий: <b>{jobs_status}</b>\n"
            "• Сообщения: <b>{msg_status}</b>\n"
            "• Системные: <b>{sys_status}</b>\n"
            "• Промо предложения: <b>{promo_status}</b>\n\n"
            "<i>Вы можете изменять настройки в вашем профиле на сайте HamKor.tj</i>"
        ),
        "jobs_header": "💼 <b>Персональные рекомендации вакансий для вас:</b>\n\n",
        "no_jobs": "🔍 На данный момент нет новых вакансий, строго соответствующих вашему профилю. Мы уведомим вас, как только они появятся!",
        "notifications_header": "🔔 <b>Ваши последние уведомления:</b>\n\n",
        "no_notifications": "📭 У вас пока нет новых уведомлений.",
        "unsubscribed": "🔇 Telegram-уведомления успешно отключены. Вы всегда можете включить их снова в вашем профиле на сайте HamKor.tj."
    },
    "tj": {
        "welcome": (
            "Салом! 👋\n\n"
            "Telegram бо муваффақият бо аккаунти шумо дар HamKor пайваст карда шуд.\n\n"
            "Акнун мо метавонем ба шумо огоҳиномаҳои муҳими шахсӣ фиристем:\n"
            "• Дархостҳои нав ва мақоми аризаҳои шумо;\n"
            "• Тағйирот дар вакансияҳо ва пешниҳодҳои мувофиқ;\n"
            "• Паёмҳои мустақим аз корфармоён ва номзадҳо;\n"
            "• Огоҳиномаҳои тизимии платформаи HamKor.\n\n"
            "Telegram-и шумо бо муваффақият пайваст шуд."
        ),
        "link_success": "🎉 Аккаунти шумо <b>{full_name}</b> бо муваффақият ба HamKor пайваст карда шуд!",
        "already_linked": "ℹ️ Ин аккаунти Telegram аллакай ба аккаунти шумо дар HamKor пайваст аст.",
        "already_linked_other": "⚠️ Ин аккаунти Telegram ба дигар корбари HamKor пайваст шудааст.",
        "invalid_token": "❌ Токени пайвастшавӣ нодуруст аст ё аллакай истифода шудааст.",
        "expired_token": "⏳ Мӯҳлати токени пайвастшавӣ гузаштааст. Лутфан дар профили худ дар HamKor.tj коди нав гиред.",
        "not_linked_instructions": (
            "👋 Салом! Ин боти расмии платформаи ҷустуҷӯи кори <b>HamKor.tj</b> мебошад.\n\n"
            "Барои пайваст кардани огоҳиномаҳо:\n"
            "1. Ба профили худ дар сомонаи <a href='http://171.22.174.199:2212'>HamKor.tj</a> ворид шавед.\n"
            "2. Ба бахши Telegram гузаред ва тугмаи <b>«Пайваст кардани Telegram»</b>-ро пахш кунед.\n"
            "3. Аз рӯи истиноди пешниҳодшуда ба ин бот гузаред."
        ),
        "help": (
            "🤖 <b>Фармонҳои боти HamKor:</b>\n\n"
            "• /start — Оғоз кардани бот / Санҷиши пайвастшавӣ\n"
            "• /profile — Нишон додани маълумоти профил\n"
            "• /jobs — Тавсияҳои шахсии вакансияҳо\n"
            "• /notifications — Огоҳиномаҳои охирин\n"
            "• /settings — Танзимоти огоҳиномаҳо\n"
            "• /unsubscribe — Хомӯш кардани огоҳиномаҳои Telegram\n"
            "• /help — Маълумот дар бораи фармонҳо"
        ),
        "profile_info": (
            "👤 <b>Профили шумо дар HamKor:</b>\n\n"
            "<b>Ном:</b> {full_name}\n"
            "<b>Логин:</b> @{username}\n"
            "<b>Email:</b> {email}\n"
            "<b>Нақш:</b> {role_str}\n"
            "<b>Шаҳр:</b> {city}\n"
            "<b>Вазифа/Корхона:</b> {position_or_company}\n"
            "<b>Огоҳиномаҳои Telegram:</b> {notifications_status}"
        ),
        "settings_info": (
            "⚙️ <b>Танзимоти огоҳиномаҳои Telegram:</b>\n\n"
            "• Огоҳиномаҳо: <b>{status}</b>\n"
            "• Тавсияҳои вакансияҳо: <b>{jobs_status}</b>\n"
            "• Паёмҳо: <b>{msg_status}</b>\n"
            "• Системавӣ: <b>{sys_status}</b>\n"
            "• Пешниҳодҳои промо: <b>{promo_status}</b>\n\n"
            "<i>Шумо метавонед танзимотро дар профили худ дар HamKor.tj тағйир диҳед</i>"
        ),
        "jobs_header": "💼 <b>Тавсияҳои шахсии вакансияҳо барои шумо:</b>\n\n",
        "no_jobs": "🔍 Ҳозирча вакансияҳои нави комилан мувофиқ пайдо нашудаанд. Пайдо шудан замон ба шумо хабар медиҳем!",
        "notifications_header": "🔔 <b>Огоҳиномаҳои охирини шумо:</b>\n\n",
        "no_notifications": "📭 Шӯмо ҳоло огоҳиномаҳои нав надоред.",
        "unsubscribed": "🔇 Огоҳиномаҳои Telegram хомӯш карда шуданд. Шумо метавонед онҳоро дилхоҳ вақт дар сомонаи HamKor.tj дубора фаъол кунед."
    },
    "en": {
        "welcome": (
            "Hello! 👋\n\n"
            "Telegram has been successfully connected to your HamKor account.\n\n"
            "Now we can send you important personal notifications:\n"
            "• New applications and status updates;\n"
            "• Job updates and relevant vacancy digests;\n"
            "• Direct messages from employers and candidates;\n"
            "• System notifications from the HamKor platform.\n\n"
            "Your Telegram account is linked successfully."
        ),
        "link_success": "🎉 Your account <b>{full_name}</b> has been successfully linked to HamKor!",
        "already_linked": "ℹ️ This Telegram account is already linked to your HamKor account.",
        "already_linked_other": "⚠️ This Telegram account is linked to another HamKor user.",
        "invalid_token": "❌ Invalid or already used linking token.",
        "expired_token": "⏳ Linking token expired. Please generate a new link code in your profile on HamKor.tj.",
        "not_linked_instructions": (
            "👋 Hello! This is the official bot for the job search platform <b>HamKor.tj</b>.\n\n"
            "To connect notifications:\n"
            "1. Open your profile on <a href='http://171.22.174.199:2212'>HamKor.tj</a>.\n"
            "2. Navigate to the Telegram section and click <b>«Connect Telegram»</b>.\n"
            "3. Follow the generated deep-link to this bot."
        ),
        "help": (
            "🤖 <b>HamKor Bot Commands:</b>\n\n"
            "• /start — Start bot / Check connection\n"
            "• /profile — Show your profile details\n"
            "• /jobs — Personalized job recommendations\n"
            "• /notifications — Recent notifications\n"
            "• /settings — Notification preferences\n"
            "• /unsubscribe — Disable Telegram notifications\n"
            "• /help — Command list & support"
        ),
        "profile_info": (
            "👤 <b>Your HamKor Profile:</b>\n\n"
            "<b>Name:</b> {full_name}\n"
            "<b>Username:</b> @{username}\n"
            "<b>Email:</b> {email}\n"
            "<b>Role:</b> {role_str}\n"
            "<b>City:</b> {city}\n"
            "<b>Position/Company:</b> {position_or_company}\n"
            "<b>Telegram Notifications:</b> {notifications_status}"
        ),
        "settings_info": (
            "⚙️ <b>Telegram Notification Settings:</b>\n\n"
            "• Notifications: <b>{status}</b>\n"
            "• Job Recommendations: <b>{jobs_status}</b>\n"
            "• Messages: <b>{msg_status}</b>\n"
            "• System Notifications: <b>{sys_status}</b>\n"
            "• Promotional Offers: <b>{promo_status}</b>\n\n"
            "<i>You can update these preferences in your profile on HamKor.tj</i>"
        ),
        "jobs_header": "💼 <b>Personalized job recommendations for you:</b>\n\n",
        "no_jobs": "🔍 No new matching jobs found right now. We will notify you as soon as matching positions open!",
        "notifications_header": "🔔 <b>Your recent notifications:</b>\n\n",
        "no_notifications": "📭 You have no recent notifications.",
        "unsubscribed": "🔇 Telegram notifications disabled. You can re-enable them anytime in your profile on HamKor.tj."
    }
}


def get_message(lang: str, key: str, **kwargs) -> str:
    """Helper to fetch localized message by key with format replacements."""
    lang_code = lang.lower() if lang else "ru"
    if lang_code not in MESSAGES:
        lang_code = "ru"

    msg = MESSAGES[lang_code].get(key) or MESSAGES["ru"].get(key, "")
    if kwargs and msg:
        try:
            return msg.format(**kwargs)
        except Exception:
            return msg
    return msg
