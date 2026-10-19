import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    _last_verification_codes: dict = {}

    @staticmethod
    def _send_smtp_message(msg: MIMEMultipart, to_email: str) -> bool:
        user = settings.get_smtp_user
        password = settings.get_smtp_password
        host = settings.get_smtp_host
        port = settings.get_smtp_port

        if not user or not password:
            logger.warning("SMTP settings not configured in .env (EMAIL_USER / SMTP_USER is empty)")
            return False

        sender = settings.get_email_from
        if "From" not in msg:
            msg["From"] = f"HamKor.tj <{sender}>"
        if "To" not in msg:
            msg["To"] = to_email

        try:
            if port == 465 or getattr(settings, "SMTP_SSL", False):
                with smtplib.SMTP_SSL(host, port, timeout=15) as server:
                    server.login(user, password)
                    server.sendmail(sender, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(host, port, timeout=15) as server:
                    server.starttls()
                    server.login(user, password)
                    server.sendmail(sender, [to_email], msg.as_string())

            logger.info("Successfully sent email to %s via %s:%s", to_email, host, port)
            return True
        except Exception as e:
            logger.error("Error sending email to %s via %s:%s: %s", to_email, host, port, e)
            return False

    @staticmethod
    def send_html_email(to_email: str, subject: str, body_html: str) -> bool:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"HamKor.tj <{settings.get_email_from}>"
        msg["To"] = to_email
        msg.attach(MIMEText(body_html, "html", "utf-8"))
        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_email(to_email: str, subject: str, body: str, sender_name: str = "Работодатель HamKor") -> bool:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{sender_name} <{settings.get_email_from}>"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 18px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 24px;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Новое предложение на HamKor.tj</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Платформа поиска работы и соискателей в Таджикистане</p>
            </div>

            <div style="padding: 8px 0; font-size: 14px; line-height: 1.6; color: #334155;">
              <p style="margin-top: 0; font-weight: 700; color: #1e293b;">Здравствуйте!</p>
              <p>Вам поступило новое сообщение от работодателя через платформу <strong>HamKor</strong>:</p>
              
              <div style="background-color: #f1f5f9; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap; font-size: 14px; color: #0f172a;">{body}</div>
              
              <p style="font-size: 13px; color: #64748b;">Вы можете ответить на это письмо напрямую на указанный email работодателя или связаться с ним на платформе HamKor.</p>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
              © 2026 HamKor Job Search Platform. Все права защищены.
            </p>
          </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_welcome_email(to_email: str, user_name: str = "") -> bool:
        """Send a rich HTML welcome email upon user registration introducing HamKor and AI tools."""
        name_str = f", {user_name}" if user_name else ""
        subject = "Добро пожаловать в HamKor! Ваш умный ИИ-помощник по поиску работы"

        plain_text = f"""
        Здравствуйте{name_str}!
        Добро пожаловать на платформу HamKor.tj — умный сервис поиска работы и подбора кадров в Таджикистане.
        
        Вы можете использовать встроенного ИИ-консультанта для мгновенной генерации резюме, оценки совпадения с вакансиями и поиска лучших предложений.
        
        С уважением,
        Команда HamKor.tj
        """

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
            
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px; border-radius: 16px; text-align: center; color: #ffffff; margin-bottom: 24px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900;">Добро пожаловать в HamKor! 🎉</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">Умная платформа поиска работы с искусственным интеллектом в Таджикистане</p>
            </div>

            <div style="padding: 8px 0; font-size: 14px; line-height: 1.7; color: #334155;">
              <p style="margin-top: 0; font-weight: 800; font-size: 16px; color: #1e293b;">Здравствуйте{name_str}!</p>
              <p>Поздравляем с успешной регистрацией на платформе <strong>HamKor.tj</strong>.</p>
              
              <div style="background-color: #f5f3ff; border: 1px solid #ddd6fe; padding: 18px; border-radius: 14px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #6d28d9; font-size: 15px; font-weight: 800;">🚀 Что вам доступно на платформе:</h3>
                <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #4c1d95; font-weight: 600; font-size: 13px;">
                  <li style="margin-bottom: 8px;">🤖 <strong>HamKor AI Консультант</strong> — умный ИИ-помощник для составления идеального резюме и анализа совпадений.</li>
                  <li style="margin-bottom: 8px;">🎯 <strong>Умный подбор вакансий</strong> — система автоматически анализирует ваши навыки и находит лучшие предложения.</li>
                  <li style="margin-bottom: 8px;">💬 <strong>Чат в реальном времени</strong> — прямое общение с работодателями и соискателями без посредников.</li>
                  <li>🔔 <strong>Уведомления и Telegram-бот</strong> — получайте мгновенные оповещения в Telegram и на сайте.</li>
                </ul>
              </div>

              <p style="font-size: 13px; color: #64748b;">Заполните ваш профиль и создайте резюме с помощью ИИ, чтобы уже сегодня получить отклики от работодателей!</p>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
              © 2026 HamKor Job Search Platform. Все права защищены.
            </p>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_verification_code_email(to_email: str, code: str) -> bool:
        """Send 6-digit verification code email."""
        EmailService._last_verification_codes[to_email] = code
        subject = f"Ваш код подтверждения HamKor: {code}"
        plain_text = f"Ваш код для подтверждения email на платформе HamKor: {code}\nКод действителен в течение 15 минут."

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 24px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800;">Подтверждение регистрации</h2>
              <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">HamKor.tj — Платформа поиска работы</p>
            </div>
            <div style="text-align: center; padding: 12px 0;">
              <p style="font-size: 15px; color: #334155; margin-bottom: 16px;">Введите этот 6-значный код для активации вашего аккаунта:</p>
              <div style="display: inline-block; background: #f1f5f9; border: 2px dashed #6366f1; padding: 16px 36px; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #4f46e5;">
                {code}
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">Код действителен 15 минут. Не сообщайте его никому.</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">© 2026 HamKor.tj</p>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_application_status_email(to_email: str, job_title: str, status_ru: str, feedback: str = "") -> bool:
        """Send notification email about application status update."""
        subject = f"Обновление статуса отклика на вакансию «{job_title}»: {status_ru}"
        feedback_block = f"<div style='background-color: #f1f5f9; border-left: 4px solid #6366f1; padding: 12px; margin: 12px 0;'><strong>Примечание работодателя:</strong> {feedback}</div>" if feedback else ""

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 24px;">
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 18px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Изменение статуса отклика</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">HamKor.tj</p>
            </div>
            <p>Здравствуйте!</p>
            <p>Статус вашего отклика на вакансию <strong>«{job_title}»</strong> изменён на: <span style="font-weight: 800; color: #4f46e5;">{status_ru}</span>.</p>
            {feedback_block}
            <p>Вы можете войти на платформу HamKor для просмотра подробностей и связи с работодателем.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0 12px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">© 2026 HamKor.tj</p>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg.attach(MIMEText(f"Статус вашего отклика на «{job_title}»: {status_ru}", "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_password_reset_email(to_email: str, reset_token: str) -> bool:
        """Send password reset email with token link."""
        subject = "Сброс пароля на платформе HamKor"
        plain_text = f"Для сброса пароля используйте следующий токен или перейдите по ссылке на сайте:\nТокен: {reset_token}\nСсылка действенна 1 час."

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px; border-radius: 12px; text-align: center; color: #ffffff; margin-bottom: 24px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800;">Запрос на сброс пароля</h2>
              <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">HamKor.tj</p>
            </div>
            <div style="padding: 12px 0;">
              <p style="font-size: 14px; color: #334155; margin-bottom: 16px;">Вы запросили сброс пароля для вашего аккаунта. Используйте следующий маркер восстановления:</p>
              <div style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 14px; border-radius: 8px; font-family: monospace; font-size: 14px; word-break: break-all; color: #1e293b; text-align: center;">
                {reset_token}
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin-top: 16px;">Маркер действителен 1 час. Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">© 2026 HamKor.tj</p>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_application_accepted_candidate_email(to_email: str, candidate_name: str, employer_name: str, job_title: str, chat_url: str) -> bool:
        """Send email notification to candidate when employer accepts their application."""
        subject = f"Работодатель «{employer_name}» принял ваш отклик на вакансию «{job_title}»!"
        plain_text = f"Здравствуйте, {candidate_name}!\n\nРаботодатель {employer_name} принял ваш отклик на вакансию «{job_title}»!\nВы можете переписываться в чате на сайте HamKor.\n\nСсылка на чат: {chat_url}"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 22px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800;">🎉 Ваш отклик принят!</h2>
              <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">HamKor.tj — Платформа поиска работы</p>
            </div>
            
            <div style="padding: 8px 0; font-size: 14px; line-height: 1.6; color: #334155;">
              <p style="margin-top: 0; font-weight: 700; color: #1e293b;">Здравствуйте, {candidate_name}!</p>
              <p>Отличные новости! Работодатель <strong style="color: #059669;">«{employer_name}»</strong> принял ваш отклик на вакансию <strong>«{job_title}»</strong>.</p>
              
              <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; border-radius: 10px; margin: 20px 0; font-size: 14px; color: #065f46;">
                💬 Вам открыта возможность переписываться с работодателем напрямую на сайте <strong>HamKor.tj</strong>!
              </div>
              
              <div style="text-align: center; margin: 28px 0;">
                <a href="{chat_url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                  💬 Перейти в чат с работодателем
                </a>
              </div>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">© 2026 HamKor.tj. Все права защищены.</p>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_application_accepted_employer_email(to_email: str, employer_name: str, candidate_name: str, job_title: str, chat_url: str) -> bool:
        """Send confirmation email notification to employer when they accept an application."""
        subject = f"Вы приняли отклик соискателя {candidate_name} на вакансию «{job_title}»"
        plain_text = f"Здравствуйте, {employer_name}!\n\nВы успешно приняли отклик соискателя {candidate_name} на вакансию «{job_title}».\nТеперь вы можете общаться с соискателем в чате.\n\nСсылка на чат: {chat_url}"

        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
            <div style="background: linear-gradient(135deg, #4f46e5, #4338ca); padding: 22px; border-radius: 14px; text-align: center; color: #ffffff; margin-bottom: 24px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 800;">Подтверждение принятия отклика</h2>
              <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">HamKor.tj — Платформа найма</p>
            </div>
            
            <div style="padding: 8px 0; font-size: 14px; line-height: 1.6; color: #334155;">
              <p style="margin-top: 0; font-weight: 700; color: #1e293b;">Здравствуйте, {employer_name}!</p>
              <p>Вы успешно приняли отклик соискателя <strong>{candidate_name}</strong> на вашу вакансию <strong>«{job_title}»</strong>.</p>
              
              <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; padding: 16px; border-radius: 10px; margin: 20px 0; font-size: 14px; color: #3730a3;">
                ✉️ Соискателю отправлено уведомление, и теперь вы можете поддерживать с ним прямой контакт в чате сайта HamKor.
              </div>
              
              <div style="text-align: center; margin: 28px 0;">
                <a href="{chat_url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);">
                  💬 Открыть чат с соискателем
                </a>
              </div>
            </div>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">© 2026 HamKor.tj. Все права защищены.</p>
          </div>
        </body>
        </html>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)

    @staticmethod
    def send_employer_direct_email(
        to_email: str,
        candidate_name: str,
        employer_name: str,
        company_name: str,
        job_title: str,
        subject: str,
        message_body: str,
        lang: str = "ru"
    ) -> bool:
        """Send rich HTML email message directly from an employer to an applicant candidate."""
        frontend_url = getattr(settings, "FRONTEND_URL", "https://hamkor.online").rstrip("/")
        app_url = f"{frontend_url}/#applications"

        title_header = {
            "ru": f"Сообщение от компании «{company_name}»",
            "en": f"Message from {company_name}",
            "tj": f"Паём аз ширкати «{company_name}»"
        }.get(lang, f"Сообщение от компании «{company_name}»")

        intro_text = {
            "ru": f"Здравствуйте, {candidate_name}!<br/><br/>Компания <strong>«{company_name}»</strong> направила вам письмо по вашему отклику на вакансию <strong>«{job_title}»</strong>:",
            "en": f"Hello {candidate_name}!<br/><br/>Company <strong>«{company_name}»</strong> sent you a message regarding your application for <strong>«{job_title}»</strong>:",
            "tj": f"Салом, {candidate_name}!<br/><br/>Ширкати <strong>«{company_name}»</strong> ба шумо оид ба дархостатон ба вакансияи <strong>«{job_title}»</strong> паём фиристод:"
        }.get(lang, f"Здравствуйте, {candidate_name}!<br/><br/>Компания <strong>«{company_name}»</strong> направила вам письмо по вашему отклику на вакансию <strong>«{job_title}»</strong>:")

        cta_button = {
            "ru": "💬 Открыть в HamKor",
            "en": "💬 Open in HamKor",
            "tj": "💬 Боз кардан дар HamKor"
        }.get(lang, "💬 Открыть в HamKor")

        footer_text = {
            "ru": "Вы можете ответить работодателю через внутренний чат на платформе HamKor.",
            "en": "You can reply to the employer using the internal chat on HamKor.",
            "tj": "Шумо метавонед ба корфармо тавассути чати дохилии HamKor ҷавоб диҳед."
        }.get(lang, "Вы можете ответить работодателю через внутренний чат на платформе HamKor.")

        plain_text = f"""
Здравствуйте, {candidate_name}!

Компания «{company_name}» направила вам сообщение по отклику на вакансию «{job_title}»:

--------------------------------------------------
{message_body}
--------------------------------------------------

Вакансия: {job_title}
Компания: {company_name}
Работодатель: {employer_name}

Открыть в HamKor: {app_url}

С уважением,
Команда HamKor.tj
"""

        # Escape message body for safe HTML display
        safe_message = message_body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 22px; border-radius: 16px; text-align: center; color: #ffffff; margin-bottom: 24px;">
      <h2 style="margin: 0; font-size: 22px; font-weight: 800;">{title_header}</h2>
      <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.95;">HamKor.tj — Платформа найма в Таджикистане</p>
    </div>

    <!-- Main Content Body -->
    <div style="padding: 8px 0; font-size: 14px; line-height: 1.65; color: #334155;">
      <p style="margin-top: 0;">{intro_text}</p>
      
      <!-- Message Card -->
      <div style="background-color: #f1f5f9; border-left: 5px solid #6366f1; padding: 18px; border-radius: 12px; margin: 20px 0; font-size: 14px; color: #0f172a; line-height: 1.6;">
        {safe_message}
      </div>
      
      <!-- Job & Company Meta Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 18px; margin-bottom: 24px;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b; font-weight: 700; uppercase tracking-wider;">ИНФОРМАЦИЯ О ВАКАНСИИ</p>
        <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 800; color: #1e293b;">💼 Vacancy: <span style="color: #4f46e5;">{job_title}</span></p>
        <p style="margin: 0; font-size: 13px; font-weight: 800; color: #1e293b;">🏢 Company: <span style="color: #0f172a;">{company_name}</span> ({employer_name})</p>
      </div>

      <!-- Action Button -->
      <div style="text-align: center; margin: 28px 0 20px 0;">
        <a href="{app_url}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 14px; font-weight: 800; font-size: 15px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35);">
          {cta_button}
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; text-align: center; margin-top: 16px;">
        {footer_text}
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0;">
      © 2026 HamKor Job Search Platform. Все права защищены.
    </p>
  </div>
</body>
</html>
"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{company_name} (via HamKor) <{settings.get_email_from}>"
        msg["To"] = to_email
        msg.attach(MIMEText(plain_text, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        return EmailService._send_smtp_message(msg, to_email)


