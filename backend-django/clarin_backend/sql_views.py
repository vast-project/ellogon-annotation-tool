import json
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from django.forms.models import model_to_dict
from .handlers import HandlerClass
from rest_framework import status

from .models import Users, Collections, SharedCollections, \
        OpenDocuments, Documents, \
        ButtonAnnotators, CoreferenceAnnotators

from .utils import ErrorLoggingAPIView
from .mongodb_views import *
from .serializers import *

class SQLDBAPIView(ErrorLoggingAPIView):

    @staticmethod
    def normaliseNewlines(text):
        return text
        if not text:
            return text
        return "\n".join(text.splitlines())

##############################################
## Documents
##############################################
@method_decorator(ensure_csrf_cookie, name='dispatch')
class DocumentsView(SQLDBAPIView):
    # List all instances. (GET)
    def list(self, request, cid):
        collection = self.getCollection(request.user, cid)
        documents  = Documents.objects.filter(collection_id=collection)
        docs = []
        for doc in documents:
            docs.append({
                "id":                    doc.id,
                "collection_id":         doc.collection_id.pk,
                "name":                  doc.name,
                "external_name":         doc.external_name,
                "type":                  doc.type,
                "text":                  self.normaliseNewlines(doc.text),
                "data_text":             self.normaliseNewlines(doc.data_text),
                "data_binary":           doc.data_binary,
                "encoding":              doc.encoding,
                "handler":               doc.handler,
                "visualisation_options": doc.visualisation_options,
                "owner_id":              doc.owner_id.pk,
                "owner_email":           doc.owner_id.email,
                "metadata":              doc.metadata,
                "version":               doc.version,
                "updated_by":            doc.updated_by,
                "created_at":            doc.created_at,
                "updated_at":            doc.updated_at
            })
        return docs
    
    # Retrieve a single instance. (GET)
    def retrieve(self, request, cid, did):
        collection = self.getCollection(request.user, cid)
        document   = Documents.objects.get(id=did)
        is_opened = OpenDocuments.objects \
            .filter(collection_id       = collection, 
                    document_id         = document,
                    db_interactions__gt = 0) \
            .count()
        doc_record = model_to_dict(document)
        ## Normalise newlines, as expected by codemirror:
        ##   lineSeparator: string|null
        ##   Explicitly set the line separator for the editor. By default (value null),
        ##   the document will be split on CRLFs as well as lone CRs and LFs,
        ##   and a single LF will be used as line separator in all output
        doc_record['text']      = self.normaliseNewlines(doc_record['text'])
        doc_record['data_text'] = self.normaliseNewlines(doc_record['data_text'])
        if (is_opened > 0):
            doc_record["is_opened"] = True
        else:
            doc_record["is_opened"] = False
        # return {"success": True, "data": doc_record}, \
        #        status.HTTP_200_OK
        return doc_record

    # Create a new instance. (POST)
    def create(self, request, cid):
        collection = self.getCollection(request.user, cid)
        duplicateCounter = -1;
        unique_identifier = 1;
        data = request.data["data"]
        new_data = {}
        new_data["name"] = data["name"]
        owner = request.user
        new_data["type"] = "text"
        if ("type" in data and data["type"] is not None):
            new_data["type"] = data["type"].lower()
        handler_apply=False
        if ("handler" in data):
            if (isinstance(data["handler"], str) == True):
                new_data["handler"] = data["handler"]
            elif (data["handler"] is None): 
                new_data["handler"] = "none"
            else:
                if (isinstance(data["handler"], dict) == True):
                    if ("value" in data["handler"]):
                         new_data["handler"] = data["handler"]["value"]
                    else:
                       new_data["handler"] = "none"
                    if ("name" in data["handler"]):
                         new_data["handler_name"] = data["handler"]["name"]
                         handler_apply=True
                    else:
                       new_data["handler_name"] = None
                    
        new_data["metadata"] = None
        if ("metadata" in data):
            new_data["metadata"] = data["metadata"]
        new_data["data_text"] = None
        if ("data_text" in data):
            new_data["data_text"] = data["data_text"]
        if ("data_binary" in data):
            new_data["data_binary"] = data["data_binary"]
        new_data["visualisation_options"] = None
        if ("visualisation_options" in data):
            new_data["visualisation_options"] = data["visualisation_options"]
                    
        new_data["version"] = 1
        if ("version" in data):
            new_data["version"] = data["version"]
        new_data["encoding"] = data["encoding"]
        new_data["owner_id"] = owner.pk
        new_data["updated_by"] = owner.email
        new_data["collection_id"] = cid
        # check type for assigning right value to binary
        binary=False 
        handler_type= new_data["handler"].lower()
        if (handler_type=="none"):
            new_data["text"] = data["text"]
        else:
            if (handler_apply==True):
                handler = HandlerClass(data["text"],  new_data["handler"])
                vo_json = handler.apply()["documents"][0]
                if (binary==True):
                    new_data["data_binary"]= data["text"] 
                else:
                    new_data["data_text"] = data["text"]
                new_data["text"] = vo_json["text"]
                if ("info" in vo_json):
                    new_data["visualisation_options"] = json.dumps(vo_json["info"])
                else:
                    new_data["visualisation_options"] =None
        
        name = new_data["name"]
        d = Documents.objects.filter(name=new_data["name"],collection_id=collection)
        v = 1
        while(d.exists()):
            new_data["name"] = name+"_"+str(v)
            d = Documents.objects.filter(name=new_data["name"],collection_id=collection)
            v = v+1
        new_data["external_name"]= new_data["name"]
        serializer = DocumentsSerializer(data=new_data)
        if serializer.is_valid():
            instancedoc = serializer.save()  
            return {"success": True, "collection_id": cid, "document_id": instancedoc.pk}
        else:
            return {"success": False}, status.HTTP_400_BAD_REQUEST         

    # # Update an existing instance. (PUT)
    # def update(self, request, _id):
    # # Partially update an existing instance. (PATCH)
    # def partial_update(self, request, _id):
    def partial_update(self,request,cid,did):
        collection = self.getCollection(request.user, cid)
        document   = Documents.objects.filter(id=did)
        if not document.exists():
                return{"success": False, "exists": False, "flash": "An error occured"}, status.HTTP_400_BAD_REQUEST
        document_queryset = Documents.objects.filter(name=request.data["data"]["name"],collection_id=collection)
        
        print(document_queryset)
        if(document_queryset.exists()):
                return {"success": True, "exists": True, "flash": "The name you selected already exists. Please select a new name"},status.HTTP_200_OK
        serializer = DocumentsSerializer(document.get(), data={"name": request.data["data"]["name"],"external_name":request.data["data"]["name"],"updated_at":datetime.now()}, partial=True)
        if serializer.is_valid():
                d = serializer.save()
                return {"success": True, "exists": False}, status.HTTP_200_OK
        else:
            return{"success": False, "exists": False, "flash": "An error occured"}, status.HTTP_400_BAD_REQUEST

        
    # # Destroy an existing instance. (DELETE)
    def destroy(self, request, cid, did):
        collection = self.getCollection(request.user, cid)
        document   = Documents.objects.filter(id=did)
        if not document.exists():
            return {
                {"deleted": False}
            }, status.HTTP_400_BAD_REQUEST
        ## We do not now if exceptions have occured internally...
        annController = AnnotationsView()
        annController.destroy(request, cid, did, 'null')
        tempAnnController = TempAnnotationsView()
        tempAnnController.destroy(request, cid, did, 'null')
        document.delete()
        return {"deleted": True}
