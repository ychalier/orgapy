from django.urls import resolve

class IframeHeaderMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        match = resolve(request.path_info)
        if request.method != "POST" and match.view_name == "orgapy:document":
            response["X-Frame-Options"] = "SAMEORIGIN"

        return response