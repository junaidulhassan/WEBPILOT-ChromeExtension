FROM python:3.12
COPY ./ WEBPILOT-ChromeExtension/backendfile
WORKDIR /WEBPILOT-ChromeExtension/backendfile 
RUN pip install -r requirements.txt
CMD ["python", "backend.py"]
